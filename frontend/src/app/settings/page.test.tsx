import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/render';
import SettingsPage from './page';

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ priority, fill, ...props }: any) => <img {...props} />,
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock auth store (kept for backwards compat with auto-inserted mock)
vi.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(
    (selector?: any) => {
      const state = {
        user: { id: 'test-user-id', firstName: 'Test', lastName: 'User' },
        isAuthenticated: true,
        isLoading: false,
        _hasHydrated: true,
      };
      return selector ? selector(state) : state;
    },
    { getState: vi.fn(), setState: vi.fn(), subscribe: vi.fn() },
  ),
}));

// Mock profile store
vi.mock('@/store/profileStore', () => ({
  useProfileStore: Object.assign(
    (selector?: any) => {
      const state = {
        profile: { id: 'test-user-id', firstName: 'Test', lastName: 'User', avatarColor: '#6366f1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
        isSelected: true,
        _hasHydrated: true,
        deselectProfile: vi.fn(),
        setProfile: vi.fn(),
      };
      return selector ? selector(state) : state;
    },
    {
      getState: vi.fn(() => ({
        profile: { id: 'test-user-id', firstName: 'Test', lastName: 'User', avatarColor: '#6366f1' },
        isSelected: true,
        _hasHydrated: true,
        deselectProfile: vi.fn(),
        setProfile: vi.fn(),
      })),
      setState: vi.fn(),
      subscribe: vi.fn(),
    },
  ),
}));

// Mock preferences store
vi.mock('@/store/preferencesStore', () => ({
  usePreferencesStore: (selector?: any) => {
    const state = {
      preferences: { theme: 'system', defaultCurrency: 'USD' },
      isLoaded: true,
      _hasHydrated: true,
      updatePreferences: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

// Mock theme context
vi.mock('@/contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({
    theme: 'system',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
  }),
}));

// Mock auth API (profileApi)
vi.mock('@/lib/auth', () => ({
  profileApi: {
    updateProfile: vi.fn(),
    deleteProfile: vi.fn(),
    deselectProfile: vi.fn().mockResolvedValue(undefined),
  },
  authApi: {
    updateProfile: vi.fn(),
    deleteProfile: vi.fn(),
    deselectProfile: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock user settings API
vi.mock('@/lib/user-settings', () => ({
  userSettingsApi: {
    getProfile: vi.fn().mockResolvedValue({
      id: 'test-user-id',
      firstName: 'Test',
      lastName: 'User',
      avatarColor: '#6366f1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }),
    getPreferences: vi.fn().mockResolvedValue({
      dateFormat: 'browser',
      numberFormat: 'browser',
      timezone: 'browser',
      theme: 'system',
      defaultCurrency: 'USD',
      gettingStartedDismissed: false,
      weekStartsOn: 1,
      budgetDigestEnabled: true,
      budgetDigestDay: 'MONDAY',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }),
    updateProfile: vi.fn(),
    updatePreferences: vi.fn(),
  },
}));

// Mock exchange-rates API
vi.mock('@/lib/exchange-rates', () => ({
  exchangeRatesApi: {
    getCurrencies: vi.fn().mockResolvedValue([
      { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2, isActive: true },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', decimalPlaces: 2, isActive: true },
    ]),
  },
}));

// Mock AppHeader
vi.mock('@/components/layout/AppHeader', () => ({
  AppHeader: () => <div data-testid="app-header">AppHeader</div>,
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Settings heading after loading', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  it('renders the Profile section', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });
  });

  it('renders the Preferences section', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Preferences')).toBeInTheDocument();
    });
  });

  it('renders the Danger Zone section', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Danger Zone')).toBeInTheDocument();
    });
  });

  it('renders the Delete Profile button', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete profile/i })).toBeInTheDocument();
    });
  });
});
