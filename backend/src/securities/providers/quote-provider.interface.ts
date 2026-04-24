export type QuoteProviderName = "yahoo" | "msn";

export interface QuoteResult {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  regularMarketTime?: number;
  provider?: QuoteProviderName;
}

export interface HistoricalPrice {
  date: Date;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
}

export interface SecurityLookupResult {
  symbol: string;
  name: string;
  exchange: string | null;
  securityType: string | null;
  currencyCode: string | null;
}

export interface StockSectorInfo {
  sector: string | null;
  industry: string | null;
}

export interface EtfSectorWeighting {
  sector: string;
  weight: number;
}

export interface QuoteProviderOptions {
  instrumentId?: string;
  currencyCode?: string | null;
  /** User's top-N preferred exchanges, in priority order. Used for ambiguous lookups. */
  preferredExchanges?: string[];
}

export interface QuoteProvider {
  readonly name: QuoteProviderName;

  fetchQuote(
    symbol: string,
    exchange: string | null,
    opts?: QuoteProviderOptions,
  ): Promise<QuoteResult | null>;

  fetchHistorical(
    symbol: string,
    exchange: string | null,
    range?: string,
    opts?: QuoteProviderOptions,
  ): Promise<HistoricalPrice[] | null>;

  lookupSecurity(
    query: string,
    preferredExchanges?: string[],
  ): Promise<SecurityLookupResult | null>;

  fetchStockSectorInfo(
    symbol: string,
    exchange: string | null,
    opts?: QuoteProviderOptions,
  ): Promise<StockSectorInfo | null>;

  fetchEtfSectorWeightings(
    symbol: string,
    exchange: string | null,
    opts?: QuoteProviderOptions,
  ): Promise<EtfSectorWeighting[] | null>;

  getTradingDate(quote: QuoteResult): Date;

  /** MSN-specific; Yahoo returns null. Resolves the ticker to the provider's internal ID. */
  resolveInstrumentId?(
    symbol: string,
    exchange: string | null,
    preferredExchanges?: string[],
  ): Promise<string | null>;
}
