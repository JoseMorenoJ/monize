import {
  validateToolInput,
  queryTransactionsSchema,
  getAccountBalancesSchema,
  getSpendingByCategorySchema,
  getIncomeSummarySchema,
  getNetWorthHistorySchema,
  comparePeriodsSchema,
  getBudgetStatusSchema,
} from "./tool-input-schemas";

describe("tool-input-schemas", () => {
  describe("validateToolInput()", () => {
    it("returns success with data for valid query_transactions input", () => {
      const result = validateToolInput("query_transactions", {
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startDate).toBe("2026-01-01");
        expect(result.data.endDate).toBe("2026-01-31");
      }
    });

    it("returns success for unknown tool names (passthrough)", () => {
      const input = { foo: "bar", baz: 42 };
      const result = validateToolInput("unknown_tool", input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(input);
      }
    });

    it("returns error for invalid date format", () => {
      const result = validateToolInput("query_transactions", {
        startDate: "January 1, 2026",
        endDate: "2026-01-31",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid input");
        expect(result.error).toContain("startDate");
      }
    });

    it("returns error when required fields are missing", () => {
      const result = validateToolInput("query_transactions", {});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid input");
      }
    });

    it("returns error for invalid groupBy value", () => {
      const result = validateToolInput("query_transactions", {
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        groupBy: "invalid_group",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("groupBy");
      }
    });

    it("strips extra fields via Zod parsing", () => {
      const result = validateToolInput("query_transactions", {
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        maliciousField: "evil",
      });

      // Zod strips unknown keys by default
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty("maliciousField");
      }
    });
  });

  describe("queryTransactionsSchema", () => {
    it("accepts all optional fields", () => {
      const result = queryTransactionsSchema.safeParse({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        categoryNames: ["Groceries", "Dining"],
        accountNames: ["Checking"],
        searchText: "walmart",
        groupBy: "category",
        direction: "expenses",
      });

      expect(result.success).toBe(true);
    });

    it("rejects searchText over 200 chars", () => {
      const result = queryTransactionsSchema.safeParse({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        searchText: "a".repeat(201),
      });

      expect(result.success).toBe(false);
    });

    it("rejects truly unknown direction enum value", () => {
      const result = queryTransactionsSchema.safeParse({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        direction: "sideways",
      });

      expect(result.success).toBe(false);
    });

    it("normalizes common direction aliases to canonical values", () => {
      const cases: Array<[string, "expenses" | "income" | "both"]> = [
        ["expense", "expenses"],
        ["spending", "expenses"],
        ["debit", "expenses"],
        ["EXPENSES", "expenses"],
        ["earnings", "income"],
        ["revenue", "income"],
        ["credit", "income"],
        ["all", "both"],
        ["any", "both"],
      ];
      for (const [input, expected] of cases) {
        const result = queryTransactionsSchema.safeParse({
          startDate: "2026-01-01",
          endDate: "2026-01-31",
          direction: input,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.direction).toBe(expected);
        }
      }
    });
  });

  describe("getAccountBalancesSchema", () => {
    it("accepts empty input", () => {
      const result = getAccountBalancesSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts accountNames filter", () => {
      const result = getAccountBalancesSchema.safeParse({
        accountNames: ["Checking", "Savings"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects accountNames with items over 100 chars", () => {
      const result = getAccountBalancesSchema.safeParse({
        accountNames: ["a".repeat(101)],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("getSpendingByCategorySchema", () => {
    it("validates required date fields", () => {
      const result = getSpendingByCategorySchema.safeParse({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      });
      expect(result.success).toBe(true);
    });

    it("accepts topN within range", () => {
      const result = getSpendingByCategorySchema.safeParse({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        topN: 10,
      });
      expect(result.success).toBe(true);
    });

    it("rejects topN over 50", () => {
      const result = getSpendingByCategorySchema.safeParse({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        topN: 51,
      });
      expect(result.success).toBe(false);
    });

    it("rejects topN of 0", () => {
      const result = getSpendingByCategorySchema.safeParse({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        topN: 0,
      });
      expect(result.success).toBe(false);
    });

    it("coerces numeric string topN to integer", () => {
      const result = getSpendingByCategorySchema.safeParse({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        topN: "10",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.topN).toBe(10);
      }
    });

    it("rejects non-numeric string topN like 'all'", () => {
      const result = getSpendingByCategorySchema.safeParse({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        topN: "all",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("getIncomeSummarySchema", () => {
    it("accepts valid groupBy values", () => {
      for (const groupBy of ["category", "payee", "month"]) {
        const result = getIncomeSummarySchema.safeParse({
          startDate: "2026-01-01",
          endDate: "2026-01-31",
          groupBy,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid groupBy value", () => {
      const result = getIncomeSummarySchema.safeParse({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        groupBy: "week",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("getNetWorthHistorySchema", () => {
    it("accepts empty input", () => {
      const result = getNetWorthHistorySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts optional startDate and endDate", () => {
      const result = getNetWorthHistorySchema.safeParse({
        startDate: "2025-01-01",
        endDate: "2026-01-31",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid date format", () => {
      const result = getNetWorthHistorySchema.safeParse({
        startDate: "Jan 2025",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("comparePeriodsSchema", () => {
    it("validates all four period dates", () => {
      const result = comparePeriodsSchema.safeParse({
        period1Start: "2025-12-01",
        period1End: "2025-12-31",
        period2Start: "2026-01-01",
        period2End: "2026-01-31",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing period dates", () => {
      const result = comparePeriodsSchema.safeParse({
        period1Start: "2025-12-01",
        period1End: "2025-12-31",
        // Missing period2Start and period2End
      });
      expect(result.success).toBe(false);
    });

    it("accepts optional groupBy and direction", () => {
      const result = comparePeriodsSchema.safeParse({
        period1Start: "2025-12-01",
        period1End: "2025-12-31",
        period2Start: "2026-01-01",
        period2End: "2026-01-31",
        groupBy: "payee",
        direction: "income",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("getBudgetStatusSchema", () => {
    it("accepts empty input", () => {
      const result = getBudgetStatusSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts period and budgetName", () => {
      const result = getBudgetStatusSchema.safeParse({
        period: "2026-01",
        budgetName: "Monthly Budget",
      });
      expect(result.success).toBe(true);
    });

    it("rejects budgetName over 100 chars", () => {
      const result = getBudgetStatusSchema.safeParse({
        budgetName: "a".repeat(101),
      });
      expect(result.success).toBe(false);
    });
  });
});
