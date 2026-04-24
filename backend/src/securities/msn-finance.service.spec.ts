import { Test, TestingModule } from "@nestjs/testing";
import { MsnFinanceService, msnInternals } from "./msn-finance.service";

describe("MsnFinanceService", () => {
  let service: MsnFinanceService;
  let originalFetch: typeof global.fetch;

  const createResponse = (body: unknown, ok = true, status = 200) =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(typeof body === "string" ? body : ""),
    } as Response);

  beforeEach(async () => {
    originalFetch = global.fetch;
    const module: TestingModule = await Test.createTestingModule({
      providers: [MsnFinanceService],
    }).compile();
    service = module.get(MsnFinanceService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ─── pure helpers ──────────────────────────────────────────────────────

  describe("mapRangeToMsn", () => {
    it("maps common range strings", () => {
      expect(msnInternals.mapRangeToMsn("1y")).toBe("1Y");
      expect(msnInternals.mapRangeToMsn("max")).toBe("MAX");
      expect(msnInternals.mapRangeToMsn("5y")).toBe("5Y");
      expect(msnInternals.mapRangeToMsn("1d")).toBe("1D");
      expect(msnInternals.mapRangeToMsn("ytd")).toBe("YTD");
    });
    it("defaults unknown ranges to 1Y", () => {
      expect(msnInternals.mapRangeToMsn("weird")).toBe("1Y");
    });
  });

  describe("parseMsnDate", () => {
    it("parses seconds-since-epoch", () => {
      const d = msnInternals.parseMsnDate(1700000000);
      expect(d).toBeInstanceOf(Date);
      expect(d!.getUTCFullYear()).toBe(2023);
    });
    it("parses ms-since-epoch", () => {
      const d = msnInternals.parseMsnDate(1700000000000);
      expect(d!.getUTCFullYear()).toBe(2023);
    });
    it("parses ISO strings", () => {
      const d = msnInternals.parseMsnDate("2024-06-15");
      expect(d!.getUTCFullYear()).toBe(2024);
    });
    it("returns null for invalid input", () => {
      expect(msnInternals.parseMsnDate(null)).toBeNull();
      expect(msnInternals.parseMsnDate("not-a-date")).toBeNull();
    });
  });

  describe("extractQuoteFields", () => {
    it("reads PascalCase and camelCase fields", () => {
      const q = msnInternals.extractQuoteFields({
        Symbol: "MSFT",
        LastPrice: 420,
        Open: 419,
        DayHigh: 425,
        DayLow: 418,
        Volume: 1000,
        Currency: "USD",
        LastTradeTime: "2024-06-15T20:00:00Z",
      });
      expect(q).toMatchObject({
        symbol: "MSFT",
        price: 420,
        open: 419,
        high: 425,
        low: 418,
        volume: 1000,
        currency: "USD",
      });
      expect(q.time).toBeGreaterThan(1700000000);
    });
  });

  // ─── resolveInstrumentId ───────────────────────────────────────────────

  describe("resolveInstrumentId", () => {
    it("returns SecId for matching ticker and caches the result", async () => {
      global.fetch = jest.fn().mockReturnValueOnce(
        createResponse({
          data: {
            stocks: [{ Symbol: "AAPL", SecId: "a1u3p2", Exchange: "XNAS" }],
          },
        }),
      );

      const first = await service.resolveInstrumentId("AAPL", "NASDAQ");
      expect(first).toBe("a1u3p2");

      // Second call must hit the cache (no additional fetch).
      const second = await service.resolveInstrumentId("AAPL", "NASDAQ");
      expect(second).toBe("a1u3p2");
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(1);
    });

    it("prefers the exchange match when multiple candidates are returned", async () => {
      global.fetch = jest.fn().mockReturnValueOnce(
        createResponse({
          data: {
            stocks: [
              { Symbol: "SHOP", SecId: "us-shop", Exchange: "XNYS" },
              { Symbol: "SHOP", SecId: "ca-shop", Exchange: "XTSE" },
            ],
          },
        }),
      );

      const id = await service.resolveInstrumentId("SHOP", "TSX");
      expect(id).toBe("ca-shop");
    });

    it("prioritizes the user's preferred exchanges when security has no exchange", async () => {
      global.fetch = jest.fn().mockReturnValueOnce(
        createResponse({
          data: {
            stocks: [
              { Symbol: "RY", SecId: "us-ry", Exchange: "XNYS" },
              { Symbol: "RY", SecId: "ca-ry", Exchange: "XTSE" },
            ],
          },
        }),
      );

      const id = await service.resolveInstrumentId("RY", null, ["TSX", "NYSE"]);
      expect(id).toBe("ca-ry");
    });

    it("retries against en-us when the en-ca market returns nothing", async () => {
      global.fetch = jest
        .fn()
        .mockReturnValueOnce(createResponse({ data: { stocks: [] } }))
        .mockReturnValueOnce(
          createResponse({
            data: {
              stocks: [{ Symbol: "AAPL", SecId: "a1u3p2", Exchange: "XNAS" }],
            },
          }),
        );

      const id = await service.resolveInstrumentId("AAPL", "TSX");
      expect(id).toBe("a1u3p2");
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(2);
    });

    it("caches negative lookups so repeated failures don't re-query", async () => {
      global.fetch = jest
        .fn()
        .mockReturnValue(createResponse({ data: { stocks: [] } }));

      await service.resolveInstrumentId("BOGUS", "NASDAQ");
      await service.resolveInstrumentId("BOGUS", "NASDAQ");

      // Two markets tried on the first call; cache hit on the second.
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(2);
    });
  });

  // ─── fetchQuote ────────────────────────────────────────────────────────

  describe("fetchQuote", () => {
    it("uses the pre-supplied instrumentId and maps fields to QuoteResult", async () => {
      global.fetch = jest.fn().mockReturnValueOnce(
        createResponse({
          value: [
            {
              Symbol: "AAPL",
              LastPrice: 180.5,
              Open: 179,
              DayHigh: 181,
              DayLow: 178.5,
              Volume: 55000000,
              Currency: "USD",
              LastTradeTime: "2024-06-15T20:00:00Z",
            },
          ],
        }),
      );

      const quote = await service.fetchQuote("AAPL", "NASDAQ", {
        instrumentId: "a1u3p2",
      });

      expect(quote).not.toBeNull();
      expect(quote!.regularMarketPrice).toBe(180.5);
      expect(quote!.regularMarketOpen).toBe(179);
      expect(quote!.regularMarketDayHigh).toBe(181);
      expect(quote!.provider).toBe("msn");
      // Should NOT have called autosuggest since instrumentId was provided.
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(1);
    });

    it("converts GBX pence to GBP when MSN reports pence", async () => {
      global.fetch = jest.fn().mockReturnValueOnce(
        createResponse({
          value: [
            {
              Symbol: "VOD.L",
              LastPrice: 12050, // pence
              Open: 12000,
              Currency: "GBX",
            },
          ],
        }),
      );

      const quote = await service.fetchQuote("VOD", "LSE", {
        instrumentId: "vod-lse",
      });

      // 12050 pence → 120.50 GBP
      expect(quote!.regularMarketPrice).toBeCloseTo(120.5, 2);
      expect(quote!.regularMarketOpen).toBeCloseTo(120, 2);
    });

    it("returns null when MSN returns HTTP error", async () => {
      global.fetch = jest
        .fn()
        .mockReturnValueOnce(createResponse({}, false, 503));

      const quote = await service.fetchQuote("AAPL", "NASDAQ", {
        instrumentId: "a1u3p2",
      });
      expect(quote).toBeNull();
    });

    it("returns null when the price field is missing", async () => {
      global.fetch = jest
        .fn()
        .mockReturnValueOnce(createResponse({ value: [{ Symbol: "AAPL" }] }));

      const quote = await service.fetchQuote("AAPL", "NASDAQ", {
        instrumentId: "a1u3p2",
      });
      expect(quote).toBeNull();
    });

    it("resolves instrumentId automatically when not supplied", async () => {
      global.fetch = jest
        .fn()
        // autosuggest
        .mockReturnValueOnce(
          createResponse({
            data: {
              stocks: [{ Symbol: "AAPL", SecId: "a1u3p2", Exchange: "XNAS" }],
            },
          }),
        )
        // quote
        .mockReturnValueOnce(
          createResponse({
            value: [{ Symbol: "AAPL", LastPrice: 180, Currency: "USD" }],
          }),
        );

      const quote = await service.fetchQuote("AAPL", "NASDAQ");
      expect(quote).not.toBeNull();
      expect(quote!.regularMarketPrice).toBe(180);
    });
  });

  // ─── fetchHistorical ───────────────────────────────────────────────────

  describe("fetchHistorical", () => {
    it("maps the chart series to HistoricalPrice[] sorted ascending", async () => {
      global.fetch = jest.fn().mockReturnValueOnce(
        createResponse({
          series: [
            {
              Time: "2024-06-17",
              Open: 181,
              High: 183,
              Low: 180,
              Close: 182,
              Volume: 1000,
            },
            {
              Time: "2024-06-15",
              Open: 178,
              High: 181,
              Low: 177.5,
              Close: 180,
              Volume: 2000,
            },
          ],
          Currency: "USD",
        }),
      );

      const prices = await service.fetchHistorical("AAPL", "NASDAQ", "1y", {
        instrumentId: "a1u3p2",
      });

      expect(prices).not.toBeNull();
      expect(prices!.length).toBe(2);
      expect(prices![0].date < prices![1].date).toBe(true);
      expect(prices![0].close).toBe(180);
      expect(prices![1].close).toBe(182);
    });

    it("applies GBX→GBP conversion to every row", async () => {
      global.fetch = jest.fn().mockReturnValueOnce(
        createResponse({
          series: [{ Time: "2024-06-15", Close: 10000, High: 10100 }],
          Currency: "GBX",
        }),
      );

      const prices = await service.fetchHistorical("VOD", "LSE", "1y", {
        instrumentId: "vod-lse",
      });
      expect(prices![0].close).toBeCloseTo(100, 2);
      expect(prices![0].high).toBeCloseTo(101, 2);
    });

    it("returns null when MSN has no series", async () => {
      global.fetch = jest
        .fn()
        .mockReturnValueOnce(createResponse({ series: [] }));
      const prices = await service.fetchHistorical("AAPL", "NASDAQ", "1y", {
        instrumentId: "a1u3p2",
      });
      expect(prices).toBeNull();
    });
  });

  // ─── lookupSecurity ────────────────────────────────────────────────────

  describe("lookupSecurity", () => {
    it("prefers results on the user's preferred exchange", async () => {
      global.fetch = jest.fn().mockReturnValueOnce(
        createResponse({
          data: {
            stocks: [
              {
                Symbol: "SHOP",
                SecId: "us-shop",
                Exchange: "XNYS",
                Name: "Shopify Inc",
                Currency: "USD",
              },
              {
                Symbol: "SHOP",
                SecId: "ca-shop",
                Exchange: "XTSE",
                Name: "Shopify Inc",
                Currency: "CAD",
              },
            ],
          },
        }),
      );

      const result = await service.lookupSecurity("SHOP", ["TSX"]);
      expect(result).not.toBeNull();
      expect(result!.exchange).toBe("TSX");
      expect(result!.currencyCode).toBe("CAD");
    });

    it("returns null when MSN has no results", async () => {
      global.fetch = jest
        .fn()
        .mockReturnValue(createResponse({ data: { stocks: [] } }));

      const result = await service.lookupSecurity("BOGUS");
      expect(result).toBeNull();
    });

    it("returns provider + msnInstrumentId and reads alternate field names", async () => {
      // Bing sometimes returns camelCase fields, a DisplayName instead of Name,
      // and a Mic instead of Exchange. Make sure we still extract everything.
      global.fetch = jest.fn().mockReturnValueOnce(
        createResponse({
          data: {
            stocks: [
              {
                symbol: "XEQT",
                secId: "xeqt-mic",
                displayName: "iShares Core Equity ETF",
                mic: "XTSE",
                instrumentType: "ETF",
                currencyCode: "CAD",
              },
            ],
          },
        }),
      );

      const result = await service.lookupSecurity("XEQT", ["TSX"]);
      expect(result).toEqual({
        symbol: "XEQT",
        name: "iShares Core Equity ETF",
        exchange: "TSX",
        securityType: "ETF",
        currencyCode: "CAD",
        provider: "msn",
        msnInstrumentId: "xeqt-mic",
      });
    });

    it("accepts alternative response envelopes (stocks at top level)", async () => {
      global.fetch = jest.fn().mockReturnValueOnce(
        createResponse({
          stocks: [
            {
              Symbol: "AAPL",
              SecId: "a1u3p2",
              DisplayName: "Apple Inc.",
              Exchange: "XNAS",
              SecurityType: "ST",
              Currency: "USD",
            },
          ],
        }),
      );

      const result = await service.lookupSecurity("AAPL");
      expect(result?.symbol).toBe("AAPL");
      expect(result?.name).toBe("Apple Inc.");
    });

    it("accepts alternative response envelopes (value array)", async () => {
      global.fetch = jest.fn().mockReturnValueOnce(
        createResponse({
          value: [
            {
              Symbol: "TSLA",
              SecId: "tsla-id",
              DisplayName: "Tesla, Inc.",
              Exchange: "XNAS",
            },
          ],
        }),
      );

      const result = await service.lookupSecurity("TSLA");
      expect(result?.symbol).toBe("TSLA");
      expect(result?.name).toBe("Tesla, Inc.");
    });

    it("returns null when Bing's response has no ticker-shaped value and the name doesn't match the query", async () => {
      // Bing's autosuggest occasionally stuffs a company name into the Symbol
      // field for fuzzy searches. When the query ("AAPL") is also absent from
      // the display name, we can't verify the match is genuine, so return null
      // rather than risk corrupting the form.
      global.fetch = jest.fn().mockReturnValueOnce(
        createResponse({
          data: {
            stocks: [
              {
                Symbol: "Apple Inc.",
                SecId: "aapl-id",
                DisplayName: "Apple Inc.",
                Exchange: "XNAS",
              },
            ],
          },
        }),
      );

      const result = await service.lookupSecurity("AAPL");
      expect(result).toBeNull();
    });

    it("returns null for bogus queries like 'CCE*' with partial-prefix responses", async () => {
      // Query has an invalid char; Bing returns results prefixed with CCE but
      // not matching "CCE*" exactly. Match validation should reject them.
      global.fetch = jest.fn().mockReturnValueOnce(
        createResponse({
          data: {
            stocks: [
              {
                Symbol: "CCEP",
                SecId: "ccep-id",
                DisplayName: "Coca-Cola Europacific Partners",
                Exchange: "XNAS",
              },
            ],
          },
        }),
      );

      const result = await service.lookupSecurity("CCE*");
      expect(result).toBeNull();
    });

    it("matches by name when the query contains the company name", async () => {
      // Name-based lookup: query "Apple" matches "Apple Inc.".
      global.fetch = jest.fn().mockReturnValueOnce(
        createResponse({
          data: {
            stocks: [
              {
                Symbol: "AAPL",
                SecId: "a1u3p2",
                DisplayName: "Apple Inc.",
                Exchange: "XNAS",
                Currency: "USD",
              },
            ],
          },
        }),
      );

      const result = await service.lookupSecurity("Apple");
      expect(result).not.toBeNull();
      expect(result?.symbol).toBe("AAPL");
      expect(result?.name).toBe("Apple Inc.");
      expect(result?.exchange).toBe("NASDAQ");
    });

    it("uses the MIC-scan fallback when exchange is under an unknown field name", async () => {
      global.fetch = jest.fn().mockReturnValueOnce(
        createResponse({
          data: {
            stocks: [
              {
                Symbol: "AAPL",
                SecId: "a1u3p2",
                DisplayName: "Apple Inc.",
                // Exchange code appears in an unexpected field.
                VenueCode: "XNAS",
                Currency: "USD",
              },
            ],
          },
        }),
      );

      const result = await service.lookupSecurity("AAPL");
      expect(result?.exchange).toBe("NASDAQ");
    });

    it("guarantees name !== symbol when MSN only returns a ticker-like name", async () => {
      global.fetch = jest.fn().mockReturnValueOnce(
        createResponse({
          data: {
            stocks: [
              {
                Symbol: "AAPL",
                SecId: "aapl-id",
                Name: "AAPL",
                Exchange: "XNAS",
              },
            ],
          },
        }),
      );

      const result = await service.lookupSecurity("AAPL");
      // When every name candidate is itself ticker-like, we let them equal
      // the symbol rather than invent something — but they must never be
      // empty strings.
      expect(result?.symbol).toBe("AAPL");
      expect(result?.name).toBeTruthy();
    });
  });

  describe("looksLikeTicker", () => {
    it("accepts typical ticker shapes", () => {
      expect(msnInternals.looksLikeTicker("AAPL")).toBe(true);
      expect(msnInternals.looksLikeTicker("SHOP.TO")).toBe(true);
      expect(msnInternals.looksLikeTicker("BRK-A")).toBe(true);
      expect(msnInternals.looksLikeTicker("0005.HK")).toBe(true);
    });
    it("rejects company names", () => {
      expect(msnInternals.looksLikeTicker("Apple Inc.")).toBe(false);
      expect(msnInternals.looksLikeTicker("iShares Core Equity ETF")).toBe(
        false,
      );
      expect(msnInternals.looksLikeTicker("")).toBe(false);
      expect(msnInternals.looksLikeTicker(undefined)).toBe(false);
      // Very long strings (>20 chars) are not tickers.
      expect(msnInternals.looksLikeTicker("A".repeat(25))).toBe(false);
    });
  });

  describe("extractStocks", () => {
    it("reads data.stocks, stocks, value, and results", () => {
      expect(
        msnInternals.extractStocks({ data: { stocks: [{ Symbol: "A" }] } }),
      ).toHaveLength(1);
      expect(
        msnInternals.extractStocks({ stocks: [{ Symbol: "B" }] }),
      ).toHaveLength(1);
      expect(
        msnInternals.extractStocks({ value: [{ Symbol: "C" }] }),
      ).toHaveLength(1);
      expect(
        msnInternals.extractStocks({ results: [{ Symbol: "D" }] }),
      ).toHaveLength(1);
    });
    it("returns [] for unknown shapes", () => {
      expect(msnInternals.extractStocks(null)).toEqual([]);
      expect(msnInternals.extractStocks({})).toEqual([]);
      expect(msnInternals.extractStocks({ data: {} })).toEqual([]);
    });
  });

  describe("fetchEtfSectorWeightings", () => {
    it("returns null (v1 does not support MSN ETF weightings)", async () => {
      const result = await service.fetchEtfSectorWeightings();
      expect(result).toBeNull();
    });
  });
});
