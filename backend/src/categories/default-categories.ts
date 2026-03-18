export interface DefaultCategoryDefinition {
  name: string;
  subcategories: string[];
}

export const DEFAULT_INCOME_CATEGORIES: DefaultCategoryDefinition[] = [
  {
    name: "Income",
    subcategories: [
      "Sales Revenue",
      "Rent Revenue",
      "Salary",
      "Service Income",
      "Interest Income",
      "Other Income",
    ],
  },
];

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategoryDefinition[] = [
  {
    name: "Services",
    subcategories: ["Gestoria", "Software", "Legal", "Notary"],
  },
  {
    name: "Personnel",
    subcategories: [
      "Wages",
      "Social Security",
      "Health Insurance",
      "Training",
    ],
  },
  {
    name: "Taxes",
    subcategories: ["IRPF", "IS", "Autonomo"],
  },
  {
    name: "Operations",
    subcategories: ["Office", "Rent", "Equipement", "Bills"],
  },
  {
    name: "Finance",
    subcategories: ["Fees", "Interests", "Insurance", "Commissions"],
  },
  {
    name: "Marketing",
    subcategories: ["Business", "Development", "Website", "Ads", "Design"],
  },
  {
    name: "Travel",
    subcategories: ["Rentals", "Petrol", "Tickets", "Hotels", "Lunch", "Toll"],
  },
  {
    name: "Equipement",
    subcategories: ["Furniture", "Hardware", "Software"],
  },
  {
    name: "Other",
    subcategories: ["Other"],
  },
];
