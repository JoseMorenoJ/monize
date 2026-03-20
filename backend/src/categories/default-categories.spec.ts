import {
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  DefaultCategoryDefinition,
} from "./default-categories";

describe("default-categories", () => {
  describe("DEFAULT_INCOME_CATEGORIES", () => {
    it("should be a non-empty array", () => {
      expect(Array.isArray(DEFAULT_INCOME_CATEGORIES)).toBe(true);
      expect(DEFAULT_INCOME_CATEGORIES.length).toBeGreaterThan(0);
    });

    it("should have correct structure for each category", () => {
      for (const category of DEFAULT_INCOME_CATEGORIES) {
        expect(typeof category.name).toBe("string");
        expect(category.name.length).toBeGreaterThan(0);
        expect(Array.isArray(category.subcategories)).toBe(true);
      }
    });

    it("should contain Income category", () => {
      const found = DEFAULT_INCOME_CATEGORIES.find(
        (c) => c.name === "Income",
      );
      expect(found).toBeDefined();
      expect(found!.subcategories).toContain("Salary");
      expect(found!.subcategories).toContain("Interest Income");
      expect(found!.subcategories).toContain("Other Income");
    });

    it("should have unique category names", () => {
      const names = DEFAULT_INCOME_CATEGORIES.map((c) => c.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it("should have unique subcategory names within each category", () => {
      for (const category of DEFAULT_INCOME_CATEGORIES) {
        const uniqueSubs = new Set(category.subcategories);
        expect(uniqueSubs.size).toBe(category.subcategories.length);
      }
    });

    it("should contain expected number of income categories", () => {
      expect(DEFAULT_INCOME_CATEGORIES.length).toBe(1);
    });
  });

  describe("DEFAULT_EXPENSE_CATEGORIES", () => {
    it("should be a non-empty array", () => {
      expect(Array.isArray(DEFAULT_EXPENSE_CATEGORIES)).toBe(true);
      expect(DEFAULT_EXPENSE_CATEGORIES.length).toBeGreaterThan(0);
    });

    it("should have correct structure for each category", () => {
      for (const category of DEFAULT_EXPENSE_CATEGORIES) {
        expect(typeof category.name).toBe("string");
        expect(category.name.length).toBeGreaterThan(0);
        expect(Array.isArray(category.subcategories)).toBe(true);
      }
    });

    it("should contain Services category", () => {
      const found = DEFAULT_EXPENSE_CATEGORIES.find(
        (c) => c.name === "Services",
      );
      expect(found).toBeDefined();
      expect(found!.subcategories).toContain("Software");
      expect(found!.subcategories).toContain("Legal");
    });

    it("should contain Personnel category", () => {
      const found = DEFAULT_EXPENSE_CATEGORIES.find(
        (c) => c.name === "Personnel",
      );
      expect(found).toBeDefined();
      expect(found!.subcategories).toContain("Wages");
      expect(found!.subcategories).toContain("Social Security");
    });

    it("should contain Taxes category", () => {
      const found = DEFAULT_EXPENSE_CATEGORIES.find((c) => c.name === "Taxes");
      expect(found).toBeDefined();
      expect(found!.subcategories).toContain("IRPF");
      expect(found!.subcategories).toContain("IS");
    });

    it("should contain Operations category", () => {
      const found = DEFAULT_EXPENSE_CATEGORIES.find(
        (c) => c.name === "Operations",
      );
      expect(found).toBeDefined();
      expect(found!.subcategories).toContain("Office");
      expect(found!.subcategories).toContain("Rent");
    });

    it("should contain Finance category", () => {
      const found = DEFAULT_EXPENSE_CATEGORIES.find(
        (c) => c.name === "Finance",
      );
      expect(found).toBeDefined();
      expect(found!.subcategories).toContain("Fees");
      expect(found!.subcategories).toContain("Insurance");
    });

    it("should contain Marketing category", () => {
      const found = DEFAULT_EXPENSE_CATEGORIES.find(
        (c) => c.name === "Marketing",
      );
      expect(found).toBeDefined();
      expect(found!.subcategories).toContain("Ads");
      expect(found!.subcategories).toContain("Website");
    });

    it("should contain Travel category", () => {
      const found = DEFAULT_EXPENSE_CATEGORIES.find(
        (c) => c.name === "Travel",
      );
      expect(found).toBeDefined();
      expect(found!.subcategories).toContain("Petrol");
      expect(found!.subcategories).toContain("Hotels");
    });

    it("should contain Equipement category", () => {
      const found = DEFAULT_EXPENSE_CATEGORIES.find(
        (c) => c.name === "Equipement",
      );
      expect(found).toBeDefined();
      expect(found!.subcategories).toContain("Hardware");
      expect(found!.subcategories).toContain("Software");
    });

    it("should contain Other category", () => {
      const found = DEFAULT_EXPENSE_CATEGORIES.find(
        (c) => c.name === "Other",
      );
      expect(found).toBeDefined();
      expect(found!.subcategories).toContain("Other");
    });

    it("should have unique category names", () => {
      const names = DEFAULT_EXPENSE_CATEGORIES.map((c) => c.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it("should have unique subcategory names within each category", () => {
      for (const category of DEFAULT_EXPENSE_CATEGORIES) {
        const uniqueSubs = new Set(category.subcategories);
        expect(uniqueSubs.size).toBe(category.subcategories.length);
      }
    });

    it("should contain expected number of expense categories", () => {
      expect(DEFAULT_EXPENSE_CATEGORIES.length).toBe(9);
    });
  });

  describe("combined validation", () => {
    it("should have no overlapping category names between income and expense", () => {
      const incomeNames = new Set(DEFAULT_INCOME_CATEGORIES.map((c) => c.name));
      const expenseNames = DEFAULT_EXPENSE_CATEGORIES.map((c) => c.name);

      for (const name of expenseNames) {
        expect(incomeNames.has(name)).toBe(false);
      }
    });

    it("should have all category names be non-empty strings", () => {
      const allCategories = [
        ...DEFAULT_INCOME_CATEGORIES,
        ...DEFAULT_EXPENSE_CATEGORIES,
      ];
      for (const category of allCategories) {
        expect(category.name.trim()).not.toBe("");
      }
    });

    it("should have all subcategory names be non-empty strings", () => {
      const allCategories = [
        ...DEFAULT_INCOME_CATEGORIES,
        ...DEFAULT_EXPENSE_CATEGORIES,
      ];
      for (const category of allCategories) {
        for (const sub of category.subcategories) {
          expect(typeof sub).toBe("string");
          expect(sub.trim()).not.toBe("");
        }
      }
    });

    it("should export DefaultCategoryDefinition interface-compatible objects", () => {
      const typeCheck = (cat: DefaultCategoryDefinition): boolean => {
        return typeof cat.name === "string" && Array.isArray(cat.subcategories);
      };

      for (const cat of DEFAULT_INCOME_CATEGORIES) {
        expect(typeCheck(cat)).toBe(true);
      }
      for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
        expect(typeCheck(cat)).toBe(true);
      }
    });

    it("should have subcategories as string arrays (not objects or numbers)", () => {
      const allCategories = [
        ...DEFAULT_INCOME_CATEGORIES,
        ...DEFAULT_EXPENSE_CATEGORIES,
      ];
      for (const category of allCategories) {
        for (const sub of category.subcategories) {
          expect(typeof sub).toBe("string");
        }
      }
    });
  });
});
