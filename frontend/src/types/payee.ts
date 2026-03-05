import { Category } from './category';

export interface Payee {
  id: string;
  userId: string;
  name: string;
  defaultCategoryId: string | null;
  defaultCategory: Category | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  transactionCount?: number;
  lastUsedDate?: string | null;
}

export interface CreatePayeeData {
  name: string;
  defaultCategoryId?: string;
  notes?: string;
}

export interface UpdatePayeeData extends Partial<CreatePayeeData> {
  isActive?: boolean;
}

export interface PayeeSummary {
  totalPayees: number;
  payeesWithCategory: number;
  payeesWithoutCategory: number;
  activePayees: number;
  inactivePayees: number;
}

export interface CategorySuggestion {
  payeeId: string;
  payeeName: string;
  currentCategoryId: string | null;
  currentCategoryName: string | null;
  suggestedCategoryId: string;
  suggestedCategoryName: string;
  transactionCount: number;
  categoryCount: number;
  percentage: number;
}

export interface CategorySuggestionsParams {
  minTransactions: number;
  minPercentage: number;
  onlyWithoutCategory?: boolean;
}

export interface CategoryAssignment {
  payeeId: string;
  categoryId: string;
}

export interface DeactivationPreviewParams {
  maxTransactions: number;
  monthsUnused: number;
}

export interface DeactivationCandidate {
  payeeId: string;
  payeeName: string;
  transactionCount: number;
  lastUsedDate: string | null;
  defaultCategoryName: string | null;
}

export type PayeeStatusFilter = 'active' | 'inactive' | 'all';
