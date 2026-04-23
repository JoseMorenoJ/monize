import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test/render';
import { DividendIncomeReport } from './DividendIncomeReport';

vi.mock('@/hooks/useNumberFormat', () => ({
  useNumberFormat: () => ({
    formatCurrency: (n: number, _currency?: string) => `$${n.toFixed(2)}`,
    formatCurrencyCompact: (n: number) => `$${n.toFixed(0)}`,
    formatCurrencyAxis: (n: number) => `$${n}`,
    defaultCurrency: 'CAD',
  }),
}));

vi.mock('@/hooks/useExchangeRates', () => ({
  useExchangeRates: () => ({
    convertToDefault: (amount: number, _currency: string) => amount,
    defaultCurrency: 'CAD',
  }),
}));

vi.mock('@/hooks/useDateRange', () => ({
  useDateRange: () => ({
    dateRange: '1y',
    setDateRange: vi.fn(),
    startDate: '',
    setStartDate: vi.fn(),
    endDate: '',
    setEndDate: vi.fn(),
    resolvedRange: { start: '2024-01-01', end: '2025-01-01' },
    isValid: true,
  }),
}));

vi.mock('@/lib/utils', () => ({
  parseLocalDate: (d: string) => new Date(d + 'T00:00:00'),
}));

vi.mock('@/components/ui/DateRangeSelector', () => ({
  DateRangeSelector: () => <div data-testid="date-range-selector" />,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ name }: any) => <div data-testid={`bar-${name}`} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ReferenceLine: () => null,
  Cell: () => null,
}));

const mockGetTransactions = vi.fn();
const mockGetInvestmentAccounts = vi.fn();
const mockGetCapitalGains = vi.fn();

vi.mock('@/lib/investments', () => ({
  investmentsApi: {
    getTransactions: (...args: any[]) => mockGetTransactions(...args),
    getInvestmentAccounts: (...args: any[]) => mockGetInvestmentAccounts(...args),
    getCapitalGains: (...args: any[]) => mockGetCapitalGains(...args),
  },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('DividendIncomeReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockGetTransactions.mockReturnValue(new Promise(() => {}));
    mockGetInvestmentAccounts.mockReturnValue(new Promise(() => {}));
    mockGetCapitalGains.mockReturnValue(new Promise(() => {}));
    render(<DividendIncomeReport />);
    expect(document.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders empty state when there is no investment activity', async () => {
    mockGetTransactions.mockResolvedValue({ data: [], pagination: { hasMore: false } });
    mockGetInvestmentAccounts.mockResolvedValue([]);
    mockGetCapitalGains.mockResolvedValue([]);
    render(<DividendIncomeReport />);
    await waitFor(() => {
      expect(
        screen.getByText(/No dividends, interest, or capital gain activity/),
      ).toBeInTheDocument();
    });
  });

  it('folds monthly capital gains (realized + unrealized) from the backend into Capital Gains', async () => {
    mockGetTransactions.mockResolvedValue({ data: [], pagination: { hasMore: false } });
    mockGetInvestmentAccounts.mockResolvedValue([
      { id: 'acc-1', name: 'TFSA', currencyCode: 'CAD', accountSubType: 'INVESTMENT_CASH' },
    ]);
    mockGetCapitalGains.mockResolvedValue([
      {
        month: '2024-08',
        accountId: 'acc-1',
        accountName: 'TFSA',
        accountCurrencyCode: 'CAD',
        securityId: 'sec-1',
        symbol: 'ABC',
        securityName: 'ABC Corp',
        securityCurrencyCode: 'CAD',
        startQuantity: 10,
        endQuantity: 0,
        startValue: 800,
        endValue: 0,
        buys: 0,
        sells: 800,
        realizedGain: 300,
        unrealizedGain: 0,
        totalCapitalGain: 300,
      },
    ]);
    render(<DividendIncomeReport />);
    await waitFor(() => {
      expect(screen.getAllByText('Capital Gains').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('$300.00').length).toBeGreaterThan(0);
  });

  it('shows negative capital gain totals (losses) with red styling', async () => {
    mockGetTransactions.mockResolvedValue({ data: [], pagination: { hasMore: false } });
    mockGetInvestmentAccounts.mockResolvedValue([
      { id: 'acc-1', name: 'RRSP', currencyCode: 'CAD', accountSubType: 'INVESTMENT_CASH' },
    ]);
    mockGetCapitalGains.mockResolvedValue([
      {
        month: '2024-03',
        accountId: 'acc-1',
        accountName: 'RRSP',
        accountCurrencyCode: 'CAD',
        securityId: 'sec-2',
        symbol: 'DEF',
        securityName: 'DEF Corp',
        securityCurrencyCode: 'CAD',
        startQuantity: 100,
        endQuantity: 100,
        startValue: 5000,
        endValue: 4500,
        buys: 0,
        sells: 0,
        realizedGain: 0,
        unrealizedGain: -500,
        totalCapitalGain: -500,
      },
    ]);
    render(<DividendIncomeReport />);
    await waitFor(() => {
      expect(screen.getAllByText('Capital Gains').length).toBeGreaterThan(0);
    });
    // Negative total renders as -$500.00 inside the summary card.
    expect(screen.getAllByText('$-500.00').length).toBeGreaterThan(0);
  });

  it('renders summary cards with data', async () => {
    mockGetTransactions.mockResolvedValue({
      data: [
        {
          id: 'tx-1',
          transactionDate: '2024-06-15',
          action: 'DIVIDEND',
          totalAmount: 100,
          accountId: 'acc-1',
          security: { symbol: 'VFV', name: 'Vanguard S&P 500' },
        },
        {
          id: 'tx-2',
          transactionDate: '2024-07-15',
          action: 'INTEREST',
          totalAmount: 25,
          accountId: 'acc-1',
          security: { symbol: 'CASH', name: 'Cash Interest' },
        },
      ],
      pagination: { hasMore: false },
    });
    mockGetInvestmentAccounts.mockResolvedValue([
      { id: 'acc-1', name: 'TFSA', currencyCode: 'CAD', accountSubType: 'INVESTMENT_CASH' },
    ]);
    mockGetCapitalGains.mockResolvedValue([]);
    render(<DividendIncomeReport />);
    await waitFor(() => {
      expect(screen.getAllByText('Dividends').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Interest').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Capital Gains').length).toBeGreaterThan(0);
    expect(screen.getByText('Total Income')).toBeInTheDocument();
  });

  it('renders view type buttons', async () => {
    mockGetTransactions.mockResolvedValue({ data: [], pagination: { hasMore: false } });
    mockGetInvestmentAccounts.mockResolvedValue([]);
    mockGetCapitalGains.mockResolvedValue([]);
    render(<DividendIncomeReport />);
    await waitFor(() => {
      expect(screen.getByText('Monthly')).toBeInTheDocument();
    });
    expect(screen.getByText('By Security')).toBeInTheDocument();
  });

  it('renders series toggles and hides a series when its checkbox is unchecked', async () => {
    mockGetTransactions.mockResolvedValue({
      data: [
        {
          id: 'tx-1',
          transactionDate: '2024-06-15',
          action: 'DIVIDEND',
          totalAmount: 100,
          accountId: 'acc-1',
          security: { symbol: 'VFV', name: 'Vanguard S&P 500' },
        },
      ],
      pagination: { hasMore: false },
    });
    mockGetInvestmentAccounts.mockResolvedValue([
      { id: 'acc-1', name: 'TFSA', currencyCode: 'CAD', accountSubType: 'INVESTMENT_CASH' },
    ]);
    mockGetCapitalGains.mockResolvedValue([]);
    render(<DividendIncomeReport />);

    // Wait until the chart's Capital Gains bar appears, then toggle it off.
    await waitFor(() => {
      expect(screen.getByTestId('bar-Capital Gains')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    // Three series toggles: Dividends, Interest, Capital Gains. All checked by default.
    expect(checkboxes).toHaveLength(3);
    const capitalGainsCheckbox = checkboxes[2];
    fireEvent.click(capitalGainsCheckbox);

    await waitFor(() => {
      expect(screen.queryByTestId('bar-Capital Gains')).not.toBeInTheDocument();
    });
    // Other bars remain visible.
    expect(screen.getByTestId('bar-Dividends')).toBeInTheDocument();
    expect(screen.getByTestId('bar-Interest')).toBeInTheDocument();
  });
});
