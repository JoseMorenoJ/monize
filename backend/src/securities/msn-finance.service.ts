import { Injectable, Logger } from "@nestjs/common";
import { isGbxCurrency, convertGbxToGbp } from "../common/gbx-currency.util";
import {
  QuoteProvider,
  QuoteProviderName,
  QuoteProviderOptions,
  QuoteResult,
  HistoricalPrice,
  SecurityLookupResult,
  StockSectorInfo,
  EtfSectorWeighting,
} from "./providers/quote-provider.interface";
import { getTradingDateFromQuote } from "./providers/trading-date.util";

// MSN API endpoints. These are reverse-engineered from msn.com/money pages and
// services.bingapis.com; treat as best-effort and expect to update these
// constants if MSN changes their surface.
const AUTOSUGGEST_URL =
  "https://services.bingapis.com/contentservices-finance.csautosuggest/api/v1/Query";
const QUOTE_URL = "https://assets.msn.com/service/news/feed/pages/finance";
const CHART_URL = "https://assets.msn.com/service/Finance/Charts/timeseries";
const STOCK_DETAILS_PAGE = "https://www.msn.com/en-us/money/stockdetails";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const REFERER = "https://www.msn.com/en-us/money";
const FETCH_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_SIZE = 500;

// Monize exchange name → MSN ISO MIC / exchange code.
const EXCHANGE_TO_MSN: Record<string, string> = {
  NASDAQ: "XNAS",
  NYSE: "XNYS",
  AMEX: "XASE",
  ARCA: "ARCX",
  TSX: "XTSE",
  TSE: "XTSE",
  "TSX-V": "XTSX",
  TSXV: "XTSX",
  CSE: "XCNQ",
  NEO: "NEOE",
  LSE: "XLON",
  LONDON: "XLON",
  ASX: "XASX",
  FRANKFURT: "XFRA",
  XETRA: "XETR",
  PARIS: "XPAR",
  TOKYO: "XTKS",
  HKEX: "XHKG",
  "HONG KONG": "XHKG",
};

// Exchanges that are served by the Canadian MSN market.
const CANADIAN_EXCHANGES = new Set([
  "TSX",
  "TSE",
  "TSX-V",
  "TSXV",
  "CSE",
  "NEO",
]);

interface CacheEntry {
  id: string | null;
  expiresAt: number;
}

// AutosuggestItem is intentionally declared as a loose record because Bing
// Finance's autosuggest uses inconsistent casing AND occasionally wraps codes
// in nested objects (e.g. `Mic: { Id: "XNAS" }`). We read fields via helpers
// that tolerate both shapes.
type AutosuggestItem = Record<string, unknown>;

/**
 * Pluck a string value from an item by trying each candidate key. Tolerates
 * nested objects: if the candidate key points to an object, descend into
 * `Id`/`id`/`Code`/`code`/`Value`/`value`/`Name`/`name` and use that. This
 * matches Bing's occasional `{ Mic: { Id: "XNAS", Name: "Nasdaq" } }` shape.
 */
function getField(
  item: AutosuggestItem,
  ...candidates: string[]
): string | undefined {
  for (const key of candidates) {
    const val = item[key];
    if (typeof val === "string" && val.trim()) return val.trim();
    if (val && typeof val === "object") {
      const obj = val as Record<string, unknown>;
      for (const inner of [
        "Id",
        "id",
        "Code",
        "code",
        "Value",
        "value",
        "Name",
        "name",
      ]) {
        const nested = obj[inner];
        if (typeof nested === "string" && nested.trim()) return nested.trim();
      }
    }
  }
  return undefined;
}

/**
 * Stock tickers are short (typically 2–15 chars), contain no spaces, and are
 * dominated by alphanumerics plus the occasional `.` or `-`. When MSN's
 * autosuggest returns a value that looks like a full company name under a
 * "symbol"-shaped field (it happens for fuzzy search matches), we reject it
 * here so symbol stays tidy.
 *
 * Minimum length is 2: 1-letter tickers exist (F, T, V) but single-character
 * values are overwhelmingly category codes or classifications in Bing's
 * responses, not tickers.
 */
function looksLikeTicker(s: string | undefined): boolean {
  if (!s) return false;
  const t = s.trim();
  if (t.length < 2 || t.length > 20) return false;
  if (/\s/.test(t)) return false;
  return /^[A-Za-z0-9._:\-+]+$/.test(t);
}

function pickFirst(
  item: AutosuggestItem,
  candidates: string[],
  predicate?: (val: string) => boolean,
): string | undefined {
  for (const key of candidates) {
    const val = getField(item, key);
    if (!val) continue;
    if (predicate && !predicate(val)) continue;
    return val;
  }
  return undefined;
}

/**
 * Last-ditch scan over every top-level string value in the match, returning
 * the first one that passes the predicate. This rescues cases where Bing
 * stores the ticker (or MIC code) under an unexpected field name that none of
 * our explicit candidate lists cover.
 *
 * Callers pass `skipKey` to exclude fields that would confuse the predicate —
 * e.g. SecId keys during a ticker scan (SecIds like "aapl-id" happen to look
 * ticker-shaped), or Symbol/Ticker keys during an exchange scan.
 */
function scanForValue(
  item: AutosuggestItem,
  predicate: (val: string) => boolean,
  skipKey: (key: string) => boolean = () => false,
): string | undefined {
  for (const key of Object.keys(item)) {
    if (skipKey(key)) continue;
    const val = item[key];
    if (typeof val === "string" && val.trim() && predicate(val.trim())) {
      return val.trim();
    }
    if (val && typeof val === "object") {
      const obj = val as Record<string, unknown>;
      for (const nestedKey of Object.keys(obj)) {
        if (skipKey(nestedKey)) continue;
        const nested = obj[nestedKey];
        if (
          typeof nested === "string" &&
          nested.trim() &&
          predicate(nested.trim())
        ) {
          return nested.trim();
        }
      }
    }
  }
  return undefined;
}

/** Keys that must never be treated as a MIC code even if their value is 4-uppercase-letters. */
const MIC_SCAN_SKIP =
  /^(sec(urity)?.?id|symbol|ticker|name|display|title|description|currency|type|kind|class|asset|short|long|id)/i;

/**
 * Tolerate multiple response envelopes. Bing-backed finance autosuggest has
 * used { data: { stocks } }, { stocks }, { value }, and { results } across
 * revisions; accept whichever one is populated.
 */
function extractStocks(data: unknown): AutosuggestItem[] {
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  const paths: unknown[] = [
    (obj.data as { stocks?: unknown } | undefined)?.stocks,
    obj.stocks,
    obj.value,
    obj.results,
    (obj.data as { value?: unknown } | undefined)?.value,
    (obj.data as { results?: unknown } | undefined)?.results,
  ];
  for (const p of paths) {
    if (Array.isArray(p) && p.length > 0) return p as AutosuggestItem[];
  }
  return [];
}

@Injectable()
export class MsnFinanceService implements QuoteProvider {
  readonly name: QuoteProviderName = "msn";

  private readonly logger = new Logger(MsnFinanceService.name);

  private readonly instrumentIdCache = new Map<string, CacheEntry>();

  // ─── Cache helpers ────────────────────────────────────────────────────────

  private cacheKey(
    symbol: string,
    exchange: string | null,
    preferredExchanges?: string[],
  ): string {
    // Preferred-exchange preferences are part of the cache key so that a user
    // whose top pick is TSX doesn't inherit a cached SecId resolved against
    // NYSE by another user's request.
    const prefs = (preferredExchanges || [])
      .slice(0, 3)
      .map((e) => e.toUpperCase())
      .join(",");
    return `${symbol.toUpperCase()}|${(exchange || "").toUpperCase()}|${prefs}`;
  }

  private getCached(key: string): CacheEntry | null {
    const entry = this.instrumentIdCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.instrumentIdCache.delete(key);
      return null;
    }
    return entry;
  }

  private setCached(key: string, id: string | null): void {
    if (this.instrumentIdCache.size >= CACHE_MAX_SIZE) {
      const oldestKey = this.instrumentIdCache.keys().next().value;
      if (oldestKey) this.instrumentIdCache.delete(oldestKey);
    }
    this.instrumentIdCache.set(key, {
      id,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  // ─── HTTP helper ──────────────────────────────────────────────────────────

  private async httpGetJson<T>(
    url: string,
    extraHeaders: Record<string, string> = {},
  ): Promise<T | null> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Referer: REFERER,
          Accept: "application/json",
          ...extraHeaders,
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(`MSN Finance GET ${url} returned ${response.status}`);
        return null;
      }
      return (await response.json()) as T;
    } catch (error) {
      this.logger.warn(
        `MSN Finance GET ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  // ─── Instrument ID resolution ─────────────────────────────────────────────

  async resolveInstrumentId(
    symbol: string,
    exchange: string | null,
    preferredExchanges?: string[],
  ): Promise<string | null> {
    const key = this.cacheKey(symbol, exchange, preferredExchanges);
    const cached = this.getCached(key);
    if (cached) return cached.id;

    const markets = this.marketOrderFor(exchange, preferredExchanges);

    for (const market of markets) {
      const id = await this.queryAutosuggest(
        symbol,
        exchange,
        market,
        preferredExchanges,
      );
      if (id) {
        this.setCached(key, id);
        return id;
      }
    }

    this.setCached(key, null);
    return null;
  }

  /**
   * Decide which MSN market (en-us / en-ca) to hit first for autosuggest.
   * Canada wins if the security's exchange or the user's top preferred exchange
   * is a Canadian one; otherwise en-us is tried first.
   */
  private marketOrderFor(
    exchange: string | null,
    preferredExchanges: string[] | undefined,
  ): string[] {
    const canadianFromExchange =
      exchange && CANADIAN_EXCHANGES.has(exchange.toUpperCase());
    const topPref = preferredExchanges?.[0]?.toUpperCase();
    const canadianFromPref = topPref ? CANADIAN_EXCHANGES.has(topPref) : false;

    return canadianFromExchange || canadianFromPref
      ? ["en-ca", "en-us"]
      : ["en-us", "en-ca"];
  }

  private async queryAutosuggest(
    query: string,
    exchange: string | null,
    market: string,
    preferredExchanges?: string[],
  ): Promise<string | null> {
    const url = `${AUTOSUGGEST_URL}?query=${encodeURIComponent(query)}&market=${encodeURIComponent(market)}&count=5`;
    const data = await this.httpGetJson<unknown>(url);
    const stocks = extractStocks(data);
    if (stocks.length === 0) return null;

    const match = this.pickBestStock(
      stocks,
      query,
      exchange,
      preferredExchanges,
    );
    return match ? getField(match, "SecId", "secId") || null : null;
  }

  private pickBestStock(
    stocks: AutosuggestItem[],
    query: string,
    exchange: string | null,
    preferredExchanges?: string[],
  ): AutosuggestItem | null {
    const upperQuery = query.toUpperCase().trim();

    const symbolOf = (s: AutosuggestItem) =>
      (
        getField(s, "Symbol", "symbol", "TradingSymbol", "tradingSymbol") || ""
      ).toUpperCase();
    const exchangeOf = (s: AutosuggestItem) =>
      (
        getField(
          s,
          "Exchange",
          "exchange",
          "Mic",
          "mic",
          "ExchangeId",
          "exchangeId",
        ) || ""
      ).toUpperCase();

    const exactSymbol = stocks.filter((s) => symbolOf(s) === upperQuery);
    const pool = exactSymbol.length > 0 ? exactSymbol : stocks;

    // 1. Direct exchange match (security's stored exchange wins).
    const targetExchange = exchange
      ? EXCHANGE_TO_MSN[exchange.toUpperCase()]
      : null;
    if (targetExchange) {
      const exchangeMatch = pool.find((s) => exchangeOf(s) === targetExchange);
      if (exchangeMatch) return exchangeMatch;
    }

    // 2. User's preferred exchanges, in priority order.
    if (preferredExchanges && preferredExchanges.length > 0) {
      for (const pref of preferredExchanges) {
        const mapped = EXCHANGE_TO_MSN[pref.toUpperCase()];
        if (!mapped) continue;
        const prefMatch = pool.find((s) => exchangeOf(s) === mapped);
        if (prefMatch) return prefMatch;
      }
    }

    return pool[0] || null;
  }

  // ─── Security lookup ──────────────────────────────────────────────────────

  async lookupSecurity(
    query: string,
    preferredExchanges?: string[],
  ): Promise<SecurityLookupResult | null> {
    // Query each market in priority order until we get results. For a user
    // whose top preferred exchange is Canadian, MSN's Canadian market yields
    // far better coverage of Canadian mutual funds than en-us does.
    const markets = this.marketOrderFor(null, preferredExchanges);
    let stocks: AutosuggestItem[] = [];
    for (const market of markets) {
      const url = `${AUTOSUGGEST_URL}?query=${encodeURIComponent(query)}&market=${encodeURIComponent(market)}&count=10`;
      const data = await this.httpGetJson<unknown>(url);
      const m = extractStocks(data);
      if (m.length > 0) {
        stocks = m;
        break;
      }
    }
    if (stocks.length === 0) return null;

    const sorted = [...stocks].sort((a, b) => {
      const ea = getField(a, "Exchange", "exchange", "Mic", "mic");
      const eb = getField(b, "Exchange", "exchange", "Mic", "mic");
      const pa = this.preferredExchangePriority(ea, preferredExchanges);
      const pb = this.preferredExchangePriority(eb, preferredExchanges);
      return pa - pb;
    });

    const SYMBOL_CANDIDATES = [
      "Symbol",
      "symbol",
      "TradingSymbol",
      "tradingSymbol",
      "Ticker",
      "ticker",
      "TickerSymbol",
      "tickerSymbol",
      "Ric",
      "ric",
      "ShortName",
      "shortName",
    ];
    const NAME_CANDIDATES = [
      "DisplayName",
      "displayName",
      "CompanyName",
      "companyName",
      "LongName",
      "longName",
      "FullName",
      "fullName",
      "Name",
      "name",
      "Title",
      "title",
      "ShortName",
      "shortName",
      "Description",
      "description",
    ];
    const EXCHANGE_CANDIDATES = [
      "Exchange",
      "exchange",
      "Mic",
      "mic",
      "MicCode",
      "micCode",
      "ExchangeId",
      "exchangeId",
      "ExchangeCode",
      "exchangeCode",
      "ExchangeName",
      "exchangeName",
      "MarketIdentifierCode",
      "marketIdentifierCode",
    ];
    const TYPE_CANDIDATES = [
      "SecurityType",
      "securityType",
      "InstrumentType",
      "instrumentType",
      "Type",
      "type",
      "AssetType",
      "assetType",
      "Kind",
      "kind",
      "Category",
      "category",
      "Class",
      "class",
    ];
    const CURRENCY_CANDIDATES = [
      "Currency",
      "currency",
      "CurrencyCode",
      "currencyCode",
      "IsoCurrency",
      "isoCurrency",
      "TradingCurrency",
      "tradingCurrency",
    ];

    // Only trust named candidates for ticker extraction. Scanning arbitrary
    // fields previously caused single-letter category codes (e.g. Class="R")
    // to surface as the symbol.
    const tickerFor = (s: AutosuggestItem): string | undefined => {
      const named = pickFirst(s, SYMBOL_CANDIDATES, looksLikeTicker);
      return named?.toUpperCase();
    };
    const nameFor = (s: AutosuggestItem): string | undefined =>
      pickFirst(s, NAME_CANDIDATES, (v) => !looksLikeTicker(v)) ||
      pickFirst(s, NAME_CANDIDATES);
    const exchangeFor = (s: AutosuggestItem): string | undefined => {
      const named = pickFirst(s, EXCHANGE_CANDIDATES);
      if (named) return named;
      // MIC codes are four uppercase letters; skip keys that would likely hold
      // a ticker or company name with those characteristics.
      return scanForValue(
        s,
        (v) => /^[A-Z]{4}$/.test(v.trim()),
        (k) => MIC_SCAN_SKIP.test(k),
      );
    };

    // Reject queries that contain characters that aren't valid in either a
    // ticker or a typical company name. Bing will happily partial-match these
    // ("CCE*" → CCEP, "foo?" → FOOB), which would surface as bogus hits.
    if (/[*?#%&!@/\\|<>]/.test(query)) {
      this.logger.log(
        `MSN lookup rejected query "${query}" (contains invalid characters)`,
      );
      return null;
    }

    const match = sorted[0];
    if (!match) return null;

    // Surface the raw first match and its extracted keys so operators can
    // adjust candidate lists when MSN changes its surface.
    this.logger.log(
      `MSN lookup "${query}" raw match keys=[${Object.keys(match).join(",")}] body=${JSON.stringify(match).slice(0, 500)}`,
    );

    const extractedTicker = tickerFor(match);
    if (!extractedTicker) {
      // We can't reliably identify the ticker. Better to return null than to
      // dump a company name into the Symbol field.
      this.logger.warn(
        `MSN lookup "${query}": no ticker-shaped value in match; returning null. Match keys=[${Object.keys(match).join(",")}]`,
      );
      return null;
    }
    const symbol = extractedTicker;

    const secId = getField(match, "SecId", "secId");
    if (secId) {
      this.setCached(this.cacheKey(symbol, null, preferredExchanges), secId);
    }

    const rawExchange = exchangeFor(match);
    const exchange = this.mapMsnExchangeToMonize(rawExchange);

    const name = nameFor(match) || symbol;

    const securityTypeRaw = pickFirst(match, TYPE_CANDIDATES);
    const securityType = this.mapMsnSecurityType(securityTypeRaw);

    const currency = pickFirst(match, CURRENCY_CANDIDATES);

    this.logger.log(
      `MSN lookup "${query}" → symbol=${symbol} name="${name}" exchange=${exchange ?? "(none)"} type=${securityType ?? "(none)"} currency=${currency ?? "(none)"} secId=${secId ?? "(none)"}`,
    );

    return {
      symbol,
      name,
      exchange,
      securityType,
      currencyCode: currency || this.currencyFromExchange(exchange),
      provider: "msn",
      msnInstrumentId: secId || null,
    };
  }

  private preferredExchangePriority(
    msnExchange: string | undefined,
    preferred?: string[],
  ): number {
    if (!preferred || preferred.length === 0) return 0;
    if (!msnExchange) return preferred.length;
    const upper = msnExchange.toUpperCase();
    for (let i = 0; i < preferred.length; i++) {
      const expected = EXCHANGE_TO_MSN[preferred[i].toUpperCase()];
      if (expected && expected === upper) return i;
    }
    return preferred.length;
  }

  private mapMsnExchangeToMonize(
    msnExchange: string | undefined,
  ): string | null {
    if (!msnExchange) return null;
    const upper = msnExchange.toUpperCase();
    for (const [monize, msn] of Object.entries(EXCHANGE_TO_MSN)) {
      if (msn === upper) return monize;
    }
    return msnExchange;
  }

  private mapMsnSecurityType(msnType: string | undefined): string | null {
    if (!msnType) return null;
    const t = msnType.toUpperCase().trim();
    // ETF before MUTUAL_FUND because "exchange-traded fund" includes "fund".
    if (
      t.includes("ETF") ||
      t === "EXCHANGE TRADED FUND" ||
      t === "EXCHANGE-TRADED FUND" ||
      t.includes("ETP")
    ) {
      return "ETF";
    }
    if (t.includes("MUTUAL") || t === "FUND" || t === "MF" || t === "OEF") {
      return "MUTUAL_FUND";
    }
    if (t.includes("BOND") || t.includes("FIXED INCOME")) return "BOND";
    if (t.includes("OPTION") || t === "OPT") return "OPTION";
    if (t.includes("CRYPT") || t === "DIGITAL CURRENCY") return "CRYPTO";
    if (
      t === "ST" ||
      t === "CS" || // common stock
      t === "PS" || // preferred stock
      t === "ADR" ||
      t.includes("STOCK") ||
      t.includes("EQUITY") ||
      t.includes("SHARE")
    ) {
      return "STOCK";
    }
    return null;
  }

  private currencyFromExchange(exchange: string | null): string | null {
    if (!exchange) return null;
    const map: Record<string, string> = {
      TSX: "CAD",
      "TSX-V": "CAD",
      TSXV: "CAD",
      CSE: "CAD",
      NEO: "CAD",
      LSE: "GBP",
      LONDON: "GBP",
      ASX: "AUD",
      FRANKFURT: "EUR",
      XETRA: "EUR",
      PARIS: "EUR",
      TOKYO: "JPY",
      HKEX: "HKD",
      "HONG KONG": "HKD",
    };
    return map[exchange.toUpperCase()] || "USD";
  }

  // ─── Quote fetch ─────────────────────────────────────────────────────────

  async fetchQuote(
    symbol: string,
    exchange: string | null,
    opts?: QuoteProviderOptions,
  ): Promise<QuoteResult | null> {
    const instrumentId =
      opts?.instrumentId ||
      (await this.resolveInstrumentId(
        symbol,
        exchange,
        opts?.preferredExchanges,
      ));
    if (!instrumentId) return null;

    const url = `${QUOTE_URL}?ids=${encodeURIComponent(instrumentId)}&type=All&apikey=&ocid=finance-peregrine`;
    const data = await this.httpGetJson<{ value?: MsnQuoteItem[] }>(url);
    const item = data?.value?.[0];
    if (!item) return null;

    const raw = extractQuoteFields(item);
    if (raw.price == null) return null;

    const shouldConvertGbx =
      isGbxCurrency(raw.currency) ||
      (raw.currency == null && isGbxCurrency(opts?.currencyCode ?? undefined));
    const convert = (v: number | undefined): number | undefined =>
      v !== undefined && shouldConvertGbx ? convertGbxToGbp(v) : v;

    return {
      symbol: (raw.symbol || symbol).toUpperCase(),
      regularMarketPrice: convert(raw.price),
      regularMarketOpen: convert(raw.open),
      regularMarketDayHigh: convert(raw.high),
      regularMarketDayLow: convert(raw.low),
      regularMarketVolume: raw.volume,
      regularMarketTime: raw.time,
      provider: "msn",
    };
  }

  // ─── Historical fetch ────────────────────────────────────────────────────

  async fetchHistorical(
    symbol: string,
    exchange: string | null,
    range: string = "max",
    opts?: QuoteProviderOptions,
  ): Promise<HistoricalPrice[] | null> {
    const instrumentId =
      opts?.instrumentId ||
      (await this.resolveInstrumentId(
        symbol,
        exchange,
        opts?.preferredExchanges,
      ));
    if (!instrumentId) return null;

    const msnRange = mapRangeToMsn(range);
    const url = `${CHART_URL}?id=${encodeURIComponent(instrumentId)}&ohlcv=true&timeFrame=${encodeURIComponent(msnRange)}`;
    const data = await this.httpGetJson<MsnChartResponse>(url);
    const series = data?.series || data?.Series || [];
    if (!Array.isArray(series) || series.length === 0) return null;

    const currency = data?.currency || data?.Currency;
    const shouldConvertGbx =
      isGbxCurrency(currency) ||
      (currency == null && isGbxCurrency(opts?.currencyCode ?? undefined));
    const convert = (v: number | null | undefined): number | null => {
      if (v == null) return null;
      return shouldConvertGbx ? convertGbxToGbp(v) : v;
    };

    const prices: HistoricalPrice[] = [];
    for (const pt of series) {
      const close = pt.close ?? pt.Close;
      if (close == null || Number.isNaN(close)) continue;
      const tsRaw = pt.time ?? pt.Time ?? pt.date ?? pt.Date;
      const date = parseMsnDate(tsRaw);
      if (!date) continue;
      prices.push({
        date,
        open: convert(pt.open ?? pt.Open),
        high: convert(pt.high ?? pt.High),
        low: convert(pt.low ?? pt.Low),
        close: shouldConvertGbx ? convertGbxToGbp(close) : close,
        volume: pt.volume ?? pt.Volume ?? null,
      });
    }

    prices.sort((a, b) => a.date.getTime() - b.date.getTime());
    return prices.length > 0 ? prices : null;
  }

  // ─── Sector / ETF data (best effort) ─────────────────────────────────────

  async fetchStockSectorInfo(
    symbol: string,
    exchange: string | null,
    opts?: QuoteProviderOptions,
  ): Promise<StockSectorInfo | null> {
    const instrumentId =
      opts?.instrumentId ||
      (await this.resolveInstrumentId(
        symbol,
        exchange,
        opts?.preferredExchanges,
      ));
    if (!instrumentId) return null;

    // Scrape the stockdetails page and read the embedded JSON. MSN's public
    // surface for sector data is limited and may not be available for all
    // security types.
    const url = `${STOCK_DETAILS_PAGE}/fi-${encodeURIComponent(instrumentId)}`;
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Referer: REFERER,
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) return null;
      const html = await response.text();
      const sector = matchInText(html, /"sector"\s*:\s*"([^"]+)"/i);
      const industry = matchInText(html, /"industry"\s*:\s*"([^"]+)"/i);
      if (!sector && !industry) return { sector: null, industry: null };
      return { sector, industry };
    } catch (error) {
      this.logger.warn(
        `MSN Finance sector fetch for ${symbol} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * MSN's public APIs do not expose ETF sector weightings in a stable shape.
   * Return null so the registry can fall back to Yahoo.
   */
  async fetchEtfSectorWeightings(): Promise<EtfSectorWeighting[] | null> {
    return null;
  }

  // ─── Utility methods ─────────────────────────────────────────────────────

  getTradingDate(quote: QuoteResult): Date {
    return getTradingDateFromQuote(quote);
  }
}

// ─── Pure helpers (not on the class so they can be unit-tested directly) ────

interface MsnQuoteItem {
  symbol?: string;
  Symbol?: string;
  price?: number;
  Price?: number;
  lastPrice?: number;
  LastPrice?: number;
  open?: number;
  Open?: number;
  regularMarketOpen?: number;
  dayHigh?: number;
  DayHigh?: number;
  high?: number;
  High?: number;
  dayLow?: number;
  DayLow?: number;
  low?: number;
  Low?: number;
  volume?: number;
  Volume?: number;
  currency?: string;
  Currency?: string;
  time?: number | string;
  Time?: number | string;
  lastTradeTime?: number | string;
  LastTradeTime?: number | string;
}

interface ExtractedQuote {
  symbol: string | undefined;
  price: number | undefined;
  open: number | undefined;
  high: number | undefined;
  low: number | undefined;
  volume: number | undefined;
  currency: string | undefined;
  time: number | undefined;
}

function extractQuoteFields(item: MsnQuoteItem): ExtractedQuote {
  return {
    symbol: item.symbol || item.Symbol,
    price:
      item.price ?? item.Price ?? item.lastPrice ?? item.LastPrice ?? undefined,
    open: item.open ?? item.Open ?? item.regularMarketOpen ?? undefined,
    high: item.dayHigh ?? item.DayHigh ?? item.high ?? item.High ?? undefined,
    low: item.dayLow ?? item.DayLow ?? item.low ?? item.Low ?? undefined,
    volume: item.volume ?? item.Volume ?? undefined,
    currency: item.currency || item.Currency,
    time: normalizeTimestamp(
      item.time ?? item.Time ?? item.lastTradeTime ?? item.LastTradeTime,
    ),
  };
}

interface MsnChartPoint {
  time?: number | string;
  Time?: number | string;
  date?: string;
  Date?: string;
  open?: number;
  Open?: number;
  high?: number;
  High?: number;
  low?: number;
  Low?: number;
  close?: number;
  Close?: number;
  volume?: number;
  Volume?: number;
}

interface MsnChartResponse {
  series?: MsnChartPoint[];
  Series?: MsnChartPoint[];
  currency?: string;
  Currency?: string;
}

function mapRangeToMsn(range: string): string {
  switch (range.toLowerCase()) {
    case "1d":
      return "1D";
    case "5d":
      return "5D";
    case "1mo":
    case "1m":
      return "1M";
    case "6mo":
    case "6m":
      return "6M";
    case "ytd":
      return "YTD";
    case "5y":
      return "5Y";
    case "max":
    case "all":
      return "MAX";
    case "1y":
    default:
      return "1Y";
  }
}

function parseMsnDate(raw: unknown): Date | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    // Assume seconds if small, milliseconds if large.
    const ms = raw > 1e12 ? raw : raw * 1000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  if (typeof raw === "string") {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  return null;
}

function normalizeTimestamp(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "number") {
    return raw > 1e12 ? Math.floor(raw / 1000) : Math.floor(raw);
  }
  if (typeof raw === "string") {
    const ms = Date.parse(raw);
    if (Number.isNaN(ms)) return undefined;
    return Math.floor(ms / 1000);
  }
  return undefined;
}

function matchInText(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m?.[1] ?? null;
}

// Exported for unit tests.
export const msnInternals = {
  extractQuoteFields,
  mapRangeToMsn,
  parseMsnDate,
  normalizeTimestamp,
  looksLikeTicker,
  extractStocks,
  EXCHANGE_TO_MSN,
};
