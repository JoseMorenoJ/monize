import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/render';
import { AppHeader } from './AppHeader';

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ priority, fill, ...props }: any) => <img {...props} />,
}));

// Track router.push calls
const mockPush = vi.fn();
let mockPathname = '/dashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
}));

// Mock profile API
const mockDeselectProfile = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/auth', () => ({
  profileApi: {
    deselectProfile: (...args: any[]) => mockDeselectProfile(...args),
  },
  authApi: {
    deselectProfile: (...args: any[]) => mockDeselectProfile(...args),
  },
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

const mockStoreDeselectProfile = vi.fn();
let mockProfile: any = {
  id: 'test-user-id',
  firstName: 'Test',
  lastName: 'User',
  avatarColor: '#6366f1',
};

vi.mock('@/store/profileStore', () => ({
  useProfileStore: () => ({
    profile: mockProfile,
    deselectProfile: mockStoreDeselectProfile,
  }),
}));

// Mock BudgetAlertBadge to avoid async act() warnings
vi.mock('@/components/budgets/BudgetAlertBadge', () => ({
  BudgetAlertBadge: () => <div data-testid="budget-alert-badge" />,
}));

describe('AppHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/dashboard';
    mockProfile = {
      id: 'test-user-id',
      firstName: 'Test',
      lastName: 'User',
      avatarColor: '#6366f1',
    };
  });

  it('renders the Monize logo and brand name', () => {
    render(<AppHeader />);
    expect(screen.getByText('Monize')).toBeInTheDocument();
    expect(screen.getByAltText('Monize')).toBeInTheDocument();
  });

  it('renders main navigation links in desktop nav', () => {
    render(<AppHeader />);
    expect(screen.getAllByText('Transactions').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Accounts').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Investments').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bills & Deposits').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Reports').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the profile first name in settings button', () => {
    render(<AppHeader />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('renders the switch profile button', () => {
    render(<AppHeader />);
    expect(screen.getByRole('button', { name: /switch profile/i })).toBeInTheDocument();
  });

  it('calls deselectProfile and redirects on switch profile click', async () => {
    render(<AppHeader />);
    const switchButton = screen.getByRole('button', { name: /switch profile/i });
    fireEvent.click(switchButton);

    await waitFor(() => {
      expect(mockDeselectProfile).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockStoreDeselectProfile).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/profiles');
    });
  });

  it('renders the Tools dropdown button', () => {
    render(<AppHeader />);
    expect(screen.getAllByText('Tools').length).toBeGreaterThanOrEqual(1);
  });

  it('opens Tools dropdown and shows tools links on click', () => {
    render(<AppHeader />);
    const toolsButtons = screen.getAllByText('Tools');
    fireEvent.click(toolsButtons[0]);

    expect(screen.getAllByText('Categories').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Payees').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Securities').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Currencies').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Import Transactions').length).toBeGreaterThanOrEqual(1);
  });

  it('navigates to tool link and closes dropdown when tool link clicked', () => {
    render(<AppHeader />);
    const toolsButtons = screen.getAllByText('Tools');
    fireEvent.click(toolsButtons[0]);

    const categoriesLinks = screen.getAllByText('Categories');
    fireEvent.click(categoriesLinks[0]);

    expect(mockPush).toHaveBeenCalledWith('/categories');
  });

  it('navigates to dashboard when logo is clicked', () => {
    render(<AppHeader />);
    const logoButton = screen.getByText('Monize');
    fireEvent.click(logoButton);
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('navigates when desktop nav link is clicked', () => {
    render(<AppHeader />);
    const transactionsButtons = screen.getAllByText('Transactions');
    fireEvent.click(transactionsButtons[0]);
    expect(mockPush).toHaveBeenCalledWith('/transactions');
  });

  it('navigates to settings when settings button is clicked', () => {
    render(<AppHeader />);
    const settingsButton = screen.getByTitle('Settings');
    fireEvent.click(settingsButton);
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('highlights active nav link based on pathname', () => {
    mockPathname = '/transactions';
    render(<AppHeader />);
    const transactionsButtons = screen.getAllByText('Transactions');
    const activeButton = transactionsButtons.find(
      (el) => el.closest('button')?.className.includes('bg-blue-100'),
    );
    expect(activeButton).toBeTruthy();
  });

  it('highlights Tools dropdown when a tools link is active', () => {
    mockPathname = '/categories';
    render(<AppHeader />);
    const toolsButtons = screen.getAllByText('Tools');
    const activeToolsButton = toolsButtons.find(
      (el) => el.closest('button')?.className.includes('bg-blue-100'),
    );
    expect(activeToolsButton).toBeTruthy();
  });

  it('toggles mobile menu when hamburger button is clicked', () => {
    render(<AppHeader />);
    const menuToggle = screen.getByLabelText('Toggle menu');

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    fireEvent.click(menuToggle);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('navigates to dashboard from mobile menu', () => {
    render(<AppHeader />);
    const menuToggle = screen.getByLabelText('Toggle menu');
    fireEvent.click(menuToggle);

    const dashboardButton = screen.getByText('Dashboard');
    fireEvent.click(dashboardButton);
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('shows no profile name when profile is null', () => {
    mockProfile = null;
    render(<AppHeader />);
    expect(screen.queryByText('Test')).not.toBeInTheDocument();
  });
});
