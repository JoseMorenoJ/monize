import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/render';
import { GroupedHoldingsList } from './GroupedHoldingsList';

vi.mock('@heroicons/react/24/outline', () => ({
  ChevronDownIcon: () => <span data-testid="chevron-down" />,
  ChevronRightIcon: () => <span data-testid="chevron-right" />,
}));

vi.mock('@/hooks/useNumberFormat', () => ({
  useNumberFormat: () => ({
    formatCurrency: (n: number, currencyCode?: string) =>
      currencyCode ? `${currencyCode} $${n.toFixed(2)}` : `$${n.toFixed(2)}`,
    numberFormat: 'en-US',
  }),
}));

// USD -> CAD @ 1.35 for tests that exercise cross-currency holdings
vi.mock('@/hooks/useExchangeRates', () => ({
  useExchangeRates: () => ({
    convert: (n: number, from: string, to?: string) => {
      if (!to || from === to) return n;
      if (from === 'USD' && to === 'CAD') return n * 1.35;
      if (from === 'CAD' && to === 'USD') return n / 1.35;
      return n;
    },
    convertToDefault: (n: number) => n,
    defaultCurrency: 'CAD',
  }),
}));

describe('GroupedHoldingsList', () => {
  it('renders loading state', () => {
    render(<GroupedHoldingsList holdingsByAccount={[]} isLoading={true} totalPortfolioValue={0} />);
    expect(screen.getByText('Holdings by Account')).toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<GroupedHoldingsList holdingsByAccount={[]} isLoading={false} totalPortfolioValue={0} />);
    expect(screen.getByText('No holdings in your portfolio.')).toBeInTheDocument();
  });

  it('renders account headers with holdings', () => {
    const holdingsByAccount = [
      {
        accountId: 'a1',
        accountName: 'RRSP',
        currencyCode: 'CAD',
        totalMarketValue: 5000,
        totalCostBasis: 4000,
        totalGainLoss: 1000,
        totalGainLossPercent: 25,
        cashBalance: 500,
        cashAccountId: 'cash1',
        holdings: [
          {
            id: 'h1', symbol: 'XEQT', name: 'iShares Equity', quantity: 100,
            averageCost: 40, currentPrice: 50, costBasis: 4000, marketValue: 5000,
            gainLoss: 1000, gainLossPercent: 25, currencyCode: 'CAD',
          },
        ],
      },
    ] as any[];

    render(<GroupedHoldingsList holdingsByAccount={holdingsByAccount} isLoading={false} totalPortfolioValue={5500} />);
    expect(screen.getByText('RRSP')).toBeInTheDocument();
    expect(screen.getByText('XEQT')).toBeInTheDocument();
  });

  it('toggles account expansion on click', () => {
    const holdingsByAccount = [
      {
        accountId: 'a1', accountName: 'RRSP', currencyCode: 'CAD',
        totalMarketValue: 5000, totalCostBasis: 4000, totalGainLoss: 1000,
        totalGainLossPercent: 25, cashBalance: 0, holdings: [
          { id: 'h1', symbol: 'XEQT', name: 'iShares', quantity: 10, averageCost: 40, currentPrice: 50, costBasis: 400, marketValue: 500, gainLoss: 100, gainLossPercent: 25, currencyCode: 'CAD' },
        ],
      },
    ] as any[];

    render(<GroupedHoldingsList holdingsByAccount={holdingsByAccount} isLoading={false} totalPortfolioValue={5000} />);
    // Initially expanded — XEQT should be visible
    expect(screen.getByText('XEQT')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(screen.getByText('RRSP'));
    expect(screen.queryByText('XEQT')).not.toBeInTheDocument();
  });

  it('shows account-currency converted values for foreign securities', () => {
    // CAD brokerage holding a USD security — cost basis, market value, and
    // gain/loss should also be rendered in the account's currency below the
    // primary (security currency) figure.
    const holdingsByAccount = [
      {
        accountId: 'a1',
        accountName: 'CAD Brokerage',
        currencyCode: 'CAD',
        totalMarketValue: 1500,
        totalCostBasis: 1000,
        totalGainLoss: 500,
        totalGainLossPercent: 50,
        cashBalance: 0,
        holdings: [
          {
            id: 'h1',
            symbol: 'AAPL',
            name: 'Apple Inc.',
            quantity: 10,
            averageCost: 100,
            currentPrice: 150,
            costBasis: 1000,
            marketValue: 1500,
            gainLoss: 500,
            gainLossPercent: 50,
            currencyCode: 'USD',
          },
        ],
      },
    ] as any[];

    render(
      <GroupedHoldingsList
        holdingsByAccount={holdingsByAccount}
        isLoading={false}
        totalPortfolioValue={2025}
      />,
    );

    // Primary values in the security's currency (USD)
    expect(screen.getByText(/USD \$1000\.00 USD/)).toBeInTheDocument(); // cost basis
    expect(screen.getByText(/USD \$1500\.00 USD/)).toBeInTheDocument(); // market value
    expect(screen.getByText(/USD \$500\.00 USD/)).toBeInTheDocument(); // gain/loss

    // Converted to account currency (CAD) at 1.35 rate
    expect(
      screen.getByText(/\u2248 CAD \$1350\.00 CAD/),
    ).toBeInTheDocument(); // cost basis converted
    expect(
      screen.getByText(/\u2248 CAD \$2025\.00 CAD/),
    ).toBeInTheDocument(); // market value converted
    expect(
      screen.getByText(/\u2248 CAD \$675\.00 CAD/),
    ).toBeInTheDocument(); // gain/loss converted
  });

  it('does not show converted values when security currency matches account currency', () => {
    const holdingsByAccount = [
      {
        accountId: 'a1',
        accountName: 'CAD Brokerage',
        currencyCode: 'CAD',
        totalMarketValue: 500,
        totalCostBasis: 400,
        totalGainLoss: 100,
        totalGainLossPercent: 25,
        cashBalance: 0,
        holdings: [
          {
            id: 'h1',
            symbol: 'XEQT',
            name: 'iShares Equity',
            quantity: 10,
            averageCost: 40,
            currentPrice: 50,
            costBasis: 400,
            marketValue: 500,
            gainLoss: 100,
            gainLossPercent: 25,
            currencyCode: 'CAD',
          },
        ],
      },
    ] as any[];

    render(
      <GroupedHoldingsList
        holdingsByAccount={holdingsByAccount}
        isLoading={false}
        totalPortfolioValue={500}
      />,
    );

    // No approximate conversion lines should appear when currencies match
    expect(screen.queryByText(/\u2248/)).not.toBeInTheDocument();
  });
});
