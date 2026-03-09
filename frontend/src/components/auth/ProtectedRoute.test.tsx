import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/render';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useProfileStore } from '@/store/profileStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { setAuthenticatedState, resetStores } from '@/test/mocks/stores';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
    usePreferencesStore.setState({
      preferences: null,
      isLoaded: false,
      _hasHydrated: true,
    });
  });

  it('shows loading spinner when store has not hydrated', () => {
    useProfileStore.setState({
      _hasHydrated: false,
      isSelected: false,
      profile: null,
    });

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Dashboard</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('redirects to /profiles when no profile selected', async () => {
    useProfileStore.setState({
      _hasHydrated: true,
      isSelected: false,
      profile: null,
    });

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Dashboard</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/profiles');
    });

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders children when profile is selected', () => {
    setAuthenticatedState();

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Dashboard</div>
      </ProtectedRoute>,
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});
