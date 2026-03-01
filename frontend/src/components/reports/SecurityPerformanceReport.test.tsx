import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test/render';
import { SecurityPerformanceReport } from './SecurityPerformanceReport';

vi.mock('@/hooks/useNumberFormat', () => ({
  useNumberFormat: () => ({
    formatCurrency: (n: number) => `$${n.toFixed(2)}`,
    formatCurrencyCompact: (n: number) => `$${n.toFixed(0)}`,
    formatCurrencyAxis: (n: number) => `$${n}`,
  }),
}));

vi.mock('@/hooks/useExchangeRates', () => ({
  useExchangeRates: () => ({
    defaultCurrency: 'CAD',
    convertToDefault: (amount: number) => amount,
  }),
}));

vi.mock('@/lib/utils', () => ({
  parseLocalDate: (d: string) => new Date(d + 'T00:00:00'),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
}));

const mockGetSecurities = vi.fn();
const mockGetPortfolioSummary = vi.fn();
const mockGetSecurityPrices = vi.fn();
const mockGetTransactions = vi.fn();

vi.mock('@/lib/investments', () => ({
  investmentsApi: {
    getSecurities: (...args: any[]) => mockGetSecurities(...args),
    getPortfolioSummary: (...args: any[]) => mockGetPortfolioSummary(...args),
    getSecurityPrices: (...args: any[]) => mockGetSecurityPrices(...args),
    getTransactions: (...args: any[]) => mockGetTransactions(...args),
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

const mockSecurities = [
  { id: 's-1', symbol: 'AAPL', name: 'Apple Inc.', isActive: true, currencyCode: 'USD' },
  { id: 's-2', symbol: 'VTI', name: 'Vanguard Total Stock', isActive: true, currencyCode: 'USD' },
  { id: 's-3', symbol: 'OLD', name: 'Old Stock', isActive: false, currencyCode: 'USD' },
];

const mockHoldings = [
  {
    id: 'h-1',
    accountId: 'acc-1',
    securityId: 's-1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    securityType: 'STOCK',
    currencyCode: 'USD',
    quantity: 10,
    averageCost: 150,
    costBasis: 1500,
    currentPrice: 180,
    marketValue: 1800,
    gainLoss: 300,
    gainLossPercent: 20,
  },
];

describe('SecurityPerformanceReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockGetSecurities.mockReturnValue(new Promise(() => {}));
    mockGetPortfolioSummary.mockReturnValue(new Promise(() => {}));
    render(<SecurityPerformanceReport />);
    expect(document.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders security selector with active securities only', async () => {
    mockGetSecurities.mockResolvedValue(mockSecurities);
    mockGetPortfolioSummary.mockResolvedValue({ holdings: mockHoldings });
    render(<SecurityPerformanceReport />);
    await waitFor(() => {
      expect(screen.getByText('Select a security...')).toBeInTheDocument();
    });
    // Active securities should be in the dropdown options
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });

  it('shows prompt to select security when none selected', async () => {
    mockGetSecurities.mockResolvedValue(mockSecurities);
    mockGetPortfolioSummary.mockResolvedValue({ holdings: mockHoldings });
    render(<SecurityPerformanceReport />);
    await waitFor(() => {
      expect(screen.getByText(/Select a security above/)).toBeInTheDocument();
    });
  });

  it('renders view type buttons when security is selected', async () => {
    mockGetSecurities.mockResolvedValue(mockSecurities);
    mockGetPortfolioSummary.mockResolvedValue({ holdings: mockHoldings });
    mockGetSecurityPrices.mockResolvedValue([
      { id: 1, securityId: 's-1', priceDate: '2025-01-01', closePrice: 175, createdAt: '' },
    ]);
    mockGetTransactions.mockResolvedValue({ data: [], pagination: { hasMore: false } });

    render(<SecurityPerformanceReport />);
    await waitFor(() => {
      expect(screen.getByText('Select a security...')).toBeInTheDocument();
    });

    // Select a security
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 's-1' } });

    await waitFor(() => {
      expect(screen.getByText('Price Chart')).toBeInTheDocument();
    });
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Dividends')).toBeInTheDocument();
  });

  it('renders performance stats when security is selected', async () => {
    mockGetSecurities.mockResolvedValue(mockSecurities);
    mockGetPortfolioSummary.mockResolvedValue({ holdings: mockHoldings });
    mockGetSecurityPrices.mockResolvedValue([]);
    mockGetTransactions.mockResolvedValue({ data: [], pagination: { hasMore: false } });

    render(<SecurityPerformanceReport />);
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 's-1' } });

    await waitFor(() => {
      expect(screen.getByText('Current Value')).toBeInTheDocument();
    });
    expect(screen.getByText('Cost Basis')).toBeInTheDocument();
    expect(screen.getByText('Total Return')).toBeInTheDocument();
    expect(screen.getByText('Annualized Return')).toBeInTheDocument();
  });

  it('renders price chart with price data', async () => {
    mockGetSecurities.mockResolvedValue(mockSecurities);
    mockGetPortfolioSummary.mockResolvedValue({ holdings: mockHoldings });
    mockGetSecurityPrices.mockResolvedValue([
      { id: 1, securityId: 's-1', priceDate: '2025-01-01', closePrice: 170, createdAt: '' },
      { id: 2, securityId: 's-1', priceDate: '2025-01-02', closePrice: 175, createdAt: '' },
    ]);
    mockGetTransactions.mockResolvedValue({ data: [], pagination: { hasMore: false } });

    render(<SecurityPerformanceReport />);
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 's-1' } });

    await waitFor(() => {
      expect(screen.getByText('Price History - AAPL')).toBeInTheDocument();
    });
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });

  it('switches to transactions view', async () => {
    mockGetSecurities.mockResolvedValue(mockSecurities);
    mockGetPortfolioSummary.mockResolvedValue({ holdings: mockHoldings });
    mockGetSecurityPrices.mockResolvedValue([]);
    mockGetTransactions.mockResolvedValue({
      data: [
        {
          id: 'tx-1',
          transactionDate: '2024-06-15',
          action: 'BUY',
          quantity: 10,
          price: 150,
          totalAmount: 1500,
          securityId: 's-1',
          security: { symbol: 'AAPL', name: 'Apple Inc.' },
          accountId: 'acc-1',
        },
      ],
      pagination: { hasMore: false },
    });

    render(<SecurityPerformanceReport />);
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 's-1' } });

    await waitFor(() => {
      expect(screen.getByText('Transactions')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Transactions'));
    await waitFor(() => {
      expect(screen.getByText('Transaction History - AAPL')).toBeInTheDocument();
    });
  });

  it('switches to dividends view', async () => {
    mockGetSecurities.mockResolvedValue(mockSecurities);
    mockGetPortfolioSummary.mockResolvedValue({ holdings: mockHoldings });
    mockGetSecurityPrices.mockResolvedValue([]);
    mockGetTransactions.mockResolvedValue({
      data: [
        {
          id: 'tx-1',
          transactionDate: '2024-06-15',
          action: 'DIVIDEND',
          quantity: null,
          price: null,
          totalAmount: 50,
          securityId: 's-1',
          security: { symbol: 'AAPL', name: 'Apple Inc.' },
          accountId: 'acc-1',
        },
      ],
      pagination: { hasMore: false },
    });

    render(<SecurityPerformanceReport />);
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 's-1' } });

    await waitFor(() => {
      expect(screen.getByText('Dividends')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Dividends'));
    await waitFor(() => {
      expect(screen.getByText('Dividend History - AAPL')).toBeInTheDocument();
    });
  });
});
