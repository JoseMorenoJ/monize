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

interface AutosuggestItem {
  // Bing Finance autosuggest uses inconsistent casing across endpoints, so
  // accept every realistic variant and normalise via getField below.
  Symbol?: string;
  symbol?: string;
  TradingSymbol?: string;
  tradingSymbol?: string;
  SecId?: string;
  secId?: string;
  Name?: string;
  name?: string;
  DisplayName?: string;
  displayName?: string;
  ShortName?: string;
  shortName?: string;
  LongName?: string;
  longName?: string;
  Description?: string;
  description?: string;
  Exchange?: string;
  exchange?: string;
  ExchangeId?: string;
  exchangeId?: string;
  Mic?: string;
  mic?: string;
  ExchangeName?: string;
  exchangeName?: string;
  SecurityType?: string;
  securityType?: string;
  Type?: string;
  type?: string;
  InstrumentType?: string;
  instrumentType?: string;
  Currency?: string;
  currency?: string;
  CurrencyCode?: string;
  currencyCode?: string;
}

function getField(
  item: AutosuggestItem,
  ...candidates: (keyof AutosuggestItem)[]
): string | undefined {
  for (const key of candidates) {
    const val = item[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return undefined;
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
    const data = await this.httpGetJson<{
      data?: { stocks?: AutosuggestItem[] };
    }>(url);
    const stocks = data?.data?.stocks || [];
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
      (getField(s, "Symbol", "symbol", "TradingSymbol", "tradingSymbol") || "")
        .toUpperCase();
    const exchangeOf = (s: AutosuggestItem) =>
      (getField(s, "Exchange", "exchange", "Mic", "mic", "ExchangeId", "exchangeId") || "")
        .toUpperCase();

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
      const data = await this.httpGetJson<{
        data?: { stocks?: AutosuggestItem[] };
      }>(url);
      const m = data?.data?.stocks || [];
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

    const upperQuery = query.toUpperCase().trim();
    const symbolOf = (s: AutosuggestItem) =>
      (getField(s, "Symbol", "symbol", "TradingSymbol", "tradingSymbol") || "")
        .toUpperCase();
    const match = sorted.find((s) => symbolOf(s) === upperQuery) || sorted[0];
    if (!match) return null;

    // Log the raw first match so the operator can see exactly which field
    // names MSN used. If a lookup ever produces garbage (e.g. Symbol =
    // the upper-cased query), pasting this log line reveals which
    // candidate field name needs to be added.
    this.logger.log(
      `MSN lookup "${query}" match keys=[${Object.keys(match).join(",")}] body=${JSON.stringify(match).slice(0, 500)}`,
    );

    const extractedSymbol = symbolOf(match);
    const extractedSecId = getField(match, "SecId", "secId");

    // If MSN returned a hit but neither a ticker-shaped Symbol nor a SecId
    // could be extracted, the result is unusable — don't dump the query
    // into the Symbol/Name fields.
    if (!extractedSymbol && !extractedSecId) {
      this.logger.warn(
        `MSN lookup "${query}": match has no Symbol or SecId; returning null. Keys=[${Object.keys(match).join(",")}]`,
      );
      return null;
    }

    const symbol = extractedSymbol || query.toUpperCase();
    const secId = extractedSecId;
    if (secId) {
      this.setCached(this.cacheKey(symbol, null, preferredExchanges), secId);
    }

    const rawExchange = getField(
      match,
      "Exchange",
      "exchange",
      "Mic",
      "mic",
      "ExchangeId",
      "exchangeId",
      "ExchangeName",
      "exchangeName",
    );
    const exchange = this.mapMsnExchangeToMonize(rawExchange);

    const name =
      getField(
        match,
        "DisplayName",
        "displayName",
        "LongName",
        "longName",
        "Name",
        "name",
        "ShortName",
        "shortName",
        "Description",
        "description",
      ) || symbol;

    const securityTypeRaw = getField(
      match,
      "SecurityType",
      "securityType",
      "InstrumentType",
      "instrumentType",
      "Type",
      "type",
    );

    const currency = getField(
      match,
      "Currency",
      "currency",
      "CurrencyCode",
      "currencyCode",
    );

    return {
      symbol,
      name,
      exchange,
      securityType: this.mapMsnSecurityType(securityTypeRaw),
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
  EXCHANGE_TO_MSN,
};
