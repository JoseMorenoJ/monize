import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/render';
import { RealizedGainsReport } from './RealizedGainsReport';

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
    resolvedRange: { start: '2025-01-01', end: '2026-01-01' },
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
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

const mockGetRealizedGains = vi.fn();
const mockGetInvestmentAccounts = vi.fn();

vi.mock('@/lib/investments', () => ({
  investmentsApi: {
    getRealizedGains: (...args: any[]) => mockGetRealizedGains(...args),
    getInvestmentAccounts: (...args: any[]) => mockGetInvestmentAccounts(...args),
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

const gainEntry = (overrides: Partial<Record<string, unknown>> = {}) => ({
  transactionId: 'sell-1',
  transactionDate: '2025-06-15',
  accountId: 'acc-1',
  accountName: 'TFSA',
  accountCurrencyCode: 'CAD',
  securityId: 'sec-1',
  symbol: 'AAPL',
  securityName: 'Apple Inc.',
  securityCurrencyCode: 'CAD',
  quantity: 50,
  price: 110,
  commission: 0,
  proceeds: 5500,
  costBasis: 5000,
  realizedGain: 500,
  ...overrides,
});

describe('RealizedGainsReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockGetRealizedGains.mockReturnValue(new Promise(() => {}));
    mockGetInvestmentAccounts.mockReturnValue(new Promise(() => {}));
    render(<RealizedGainsReport />);
    expect(document.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders empty state when no sell transactions', async () => {
    mockGetRealizedGains.mockResolvedValue([]);
    mockGetInvestmentAccounts.mockResolvedValue([]);
    render(<RealizedGainsReport />);
    await waitFor(() => {
      expect(screen.getByText(/No sell transactions found/)).toBeInTheDocument();
    });
  });

  it('renders summary cards with realized gain data', async () => {
    mockGetRealizedGains.mockResolvedValue([
      gainEntry(),
      gainEntry({
        transactionId: 'sell-2',
        transactionDate: '2025-08-20',
        symbol: 'MSFT',
        securityName: 'Microsoft Corp.',
        proceeds: 3300,
        costBasis: 3000,
        realizedGain: 300,
      }),
    ]);
    mockGetInvestmentAccounts.mockResolvedValue([
      { id: 'acc-1', name: 'TFSA', currencyCode: 'CAD', accountSubType: 'INVESTMENT_CASH' },
    ]);
    render(<RealizedGainsReport />);
    await waitFor(() => {
      expect(screen.getByText('Total Proceeds')).toBeInTheDocument();
    });
    expect(screen.getByText('Cost Basis')).toBeInTheDocument();
    expect(screen.getByText('Realized Gain/Loss')).toBeInTheDocument();
    expect(screen.getByText('Securities Sold')).toBeInTheDocument();
  });

  it('renders view type toggle buttons', async () => {
    mockGetRealizedGains.mockResolvedValue([]);
    mockGetInvestmentAccounts.mockResolvedValue([]);
    render(<RealizedGainsReport />);
    await waitFor(() => {
      expect(screen.getByTitle('Chart')).toBeInTheDocument();
    });
    expect(screen.getByTitle('Table')).toBeInTheDocument();
  });

  it('renders chart with gain data', async () => {
    mockGetRealizedGains.mockResolvedValue([gainEntry()]);
    mockGetInvestmentAccounts.mockResolvedValue([]);
    render(<RealizedGainsReport />);
    await waitFor(() => {
      expect(screen.getByText('Realized Gains by Security')).toBeInTheDocument();
    });
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders sell transactions table', async () => {
    mockGetRealizedGains.mockResolvedValue([gainEntry()]);
    mockGetInvestmentAccounts.mockResolvedValue([]);
    render(<RealizedGainsReport />);
    await waitFor(() => {
      expect(screen.getByText(/Sell Transactions/)).toBeInTheDocument();
    });
    expect(screen.getByText('AAPL')).toBeInTheDocument();
  });

  it('queries the realized-gains endpoint with the selected date range', async () => {
    mockGetRealizedGains.mockResolvedValue([]);
    mockGetInvestmentAccounts.mockResolvedValue([]);
    render(<RealizedGainsReport />);
    await waitFor(() => {
      expect(mockGetRealizedGains).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2025-01-01',
          endDate: '2026-01-01',
        }),
      );
    });
  });
});
