import { QuoteResult } from "./quote-provider.interface";

/**
 * Derive the trading date (UTC midnight) for a quote.
 * Falls back to the most recent weekday if the quote has no timestamp.
 */
export function getTradingDateFromQuote(quote: QuoteResult): Date {
  if (quote.regularMarketTime) {
    const marketDate = new Date(quote.regularMarketTime * 1000);
    marketDate.setUTCHours(0, 0, 0, 0);
    return marketDate;
  }

  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  const day = date.getUTCDay();
  if (day === 0) date.setUTCDate(date.getUTCDate() - 2);
  else if (day === 6) date.setUTCDate(date.getUTCDate() - 1);
  return date;
}
