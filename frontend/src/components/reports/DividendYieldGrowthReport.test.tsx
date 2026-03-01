import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test/render';
import { DividendYieldGrowthReport } from './DividendYieldGrowthReport';

vi.mock('@/hooks/useNumberFormat', () => ({
  useNumberFormat: () => ({
    formatCurrency: (n: number) => `$${n.toFixed(2)}`,
    formatCurrencyCompact: (n: number) => `$${n.toFixed(0)}`,
    formatCurrencyAxis: (n: number) => `$${n}`,
  }),
}));

vi.mock('@/hooks/useExchangeRates', () => ({
  useExchangeRates: () => ({
    convertToDefault: (amount: number) => amount,
    defaultCurrency: 'CAD',
  }),
}));

vi.mock('@/lib/utils', () => ({
  parseLocalDate: (d: string) => new Date(d + 'T00:00:00'),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Bar: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

const mockGetTransactions = vi.fn();
const mockGetInvestmentAccounts = vi.fn();
const mockGetPortfolioSummary = vi.fn();

vi.mock('@/lib/investments', () => ({
  investmentsApi: {
    getTransactions: (...args: any[]) => mockGetTransactions(...args),
    getInvestmentAccounts: (...args: any[]) => mockGetInvestmentAccounts(...args),
    getPortfolioSummary: (...args: any[]) => mockGetPortfolioSummary(...args),
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

const mockHoldings = [
  {
    id: 'h-1',
    accountId: 'acc-1',
    securityId: 's-1',
    symbol: 'VFV',
    name: 'Vanguard S&P 500',
    securityType: 'ETF',
    currencyCode: 'CAD',
    quantity: 50,
    averageCost: 80,
    costBasis: 4000,
    currentPrice: 100,
    marketValue: 5000,
    gainLoss: 1000,
    gainLossPercent: 25,
  },
];

describe('DividendYieldGrowthReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockGetTransactions.mockReturnValue(new Promise(() => {}));
    mockGetInvestmentAccounts.mockReturnValue(new Promise(() => {}));
    mockGetPortfolioSummary.mockReturnValue(new Promise(() => {}));
    render(<DividendYieldGrowthReport />);
    expect(document.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders empty state when no dividend transactions', async () => {
    mockGetTransactions.mockResolvedValue({ data: [], pagination: { hasMore: false } });
    mockGetInvestmentAccounts.mockResolvedValue([]);
    mockGetPortfolioSummary.mockResolvedValue({ holdings: [] });
    render(<DividendYieldGrowthReport />);
    await waitFor(() => {
      expect(screen.getByText(/No dividend transactions found/)).toBeInTheDocument();
    });
  });

  it('renders summary cards with data', async () => {
    mockGetTransactions.mockResolvedValue({
      data: [
        {
          id: 'tx-1',
          transactionDate: '2025-06-15',
          action: 'DIVIDEND',
          totalAmount: 100,
          accountId: 'acc-1',
          securityId: 's-1',
          security: { symbol: 'VFV', name: 'Vanguard S&P 500' },
        },
      ],
      pagination: { hasMore: false },
    });
    mockGetInvestmentAccounts.mockResolvedValue([
      { id: 'acc-1', name: 'TFSA', currencyCode: 'CAD', accountSubType: 'INVESTMENT_CASH' },
    ]);
    mockGetPortfolioSummary.mockResolvedValue({ holdings: mockHoldings });
    render(<DividendYieldGrowthReport />);
    await waitFor(() => {
      expect(screen.getByText('Portfolio Yield')).toBeInTheDocument();
    });
    expect(screen.getByText('Trailing 12M Dividends')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('Dividend Payers')).toBeInTheDocument();
  });

  it('renders view type buttons', async () => {
    mockGetTransactions.mockResolvedValue({ data: [], pagination: { hasMore: false } });
    mockGetInvestmentAccounts.mockResolvedValue([]);
    mockGetPortfolioSummary.mockResolvedValue({ holdings: [] });
    render(<DividendYieldGrowthReport />);
    await waitFor(() => {
      expect(screen.getByText('Per-Security Yield')).toBeInTheDocument();
    });
    expect(screen.getByText('Year-over-Year')).toBeInTheDocument();
    expect(screen.getByText('Frequency')).toBeInTheDocument();
  });

  it('shows yield table by default with dividend data', async () => {
    mockGetTransactions.mockResolvedValue({
      data: [
        {
          id: 'tx-1',
          transactionDate: '2025-09-15',
          action: 'DIVIDEND',
          totalAmount: 150,
          accountId: 'acc-1',
          securityId: 's-1',
          security: { symbol: 'VFV', name: 'Vanguard S&P 500' },
        },
      ],
      pagination: { hasMore: false },
    });
    mockGetInvestmentAccounts.mockResolvedValue([]);
    mockGetPortfolioSummary.mockResolvedValue({ holdings: mockHoldings });
    render(<DividendYieldGrowthReport />);
    await waitFor(() => {
      expect(screen.getByText('Per-Security Dividend Yield (Trailing 12 Months)')).toBeInTheDocument();
    });
  });

  it('switches to year-over-year view', async () => {
    mockGetTransactions.mockResolvedValue({
      data: [
        {
          id: 'tx-1',
          transactionDate: '2024-06-15',
          action: 'DIVIDEND',
          totalAmount: 100,
          accountId: 'acc-1',
          securityId: 's-1',
          security: { symbol: 'VFV', name: 'Vanguard S&P 500' },
        },
      ],
      pagination: { hasMore: false },
    });
    mockGetInvestmentAccounts.mockResolvedValue([]);
    mockGetPortfolioSummary.mockResolvedValue({ holdings: mockHoldings });
    render(<DividendYieldGrowthReport />);
    await waitFor(() => {
      expect(screen.getByText('Year-over-Year')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Year-over-Year'));
    await waitFor(() => {
      expect(screen.getByText('Annual Dividend Income')).toBeInTheDocument();
    });
  });

  it('switches to frequency view', async () => {
    mockGetTransactions.mockResolvedValue({
      data: [
        {
          id: 'tx-1',
          transactionDate: '2025-06-15',
          action: 'DIVIDEND',
          totalAmount: 100,
          accountId: 'acc-1',
          securityId: 's-1',
          security: { symbol: 'VFV', name: 'Vanguard S&P 500' },
        },
      ],
      pagination: { hasMore: false },
    });
    mockGetInvestmentAccounts.mockResolvedValue([]);
    mockGetPortfolioSummary.mockResolvedValue({ holdings: mockHoldings });
    render(<DividendYieldGrowthReport />);
    await waitFor(() => {
      expect(screen.getAllByText('Frequency').length).toBeGreaterThanOrEqual(1);
    });

    // Click the Frequency button (the first one is the button)
    fireEvent.click(screen.getAllByText('Frequency')[0]);
    await waitFor(() => {
      expect(screen.getByText('Dividend Frequency Analysis')).toBeInTheDocument();
    });
  });
});
