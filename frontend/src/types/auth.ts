export interface Profile {
  id: string;
  firstName: string;
  lastName?: string | null;
  avatarColor: string;
  createdAt: string;
  updatedAt: string;
}

// Backwards compat alias
export type User = Profile;

export interface UserPreferences {
  userId: string;
  defaultCurrency: string;
  dateFormat: string;
  numberFormat: string;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  gettingStartedDismissed: boolean;
  weekStartsOn: number;
  budgetDigestEnabled: boolean;
  budgetDigestDay: 'MONDAY' | 'FRIDAY';
  favouriteReportIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  avatarColor?: string;
}

export interface UpdatePreferencesData {
  defaultCurrency?: string;
  dateFormat?: string;
  numberFormat?: string;
  theme?: 'light' | 'dark' | 'system';
  timezone?: string;
  gettingStartedDismissed?: boolean;
  weekStartsOn?: number;
  budgetDigestEnabled?: boolean;
  budgetDigestDay?: 'MONDAY' | 'FRIDAY';
  favouriteReportIds?: string[];
}
