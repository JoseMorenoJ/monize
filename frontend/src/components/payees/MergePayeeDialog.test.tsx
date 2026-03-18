import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/render';
import { MergePayeeDialog } from './MergePayeeDialog';
import { Payee } from '@/types/payee';

vi.mock('@/lib/payees', () => ({
  payeesApi: {
    mergePayees: vi.fn(),
  },
}));

vi.mock('@/lib/errors', () => ({
  getErrorMessage: (_: unknown, fallback: string) => fallback,
}));

const sourcePayee: Payee = {
  id: 'p1',
  userId: 'u1',
  name: 'STARBUCKS #12345',
  defaultCategoryId: null,
  defaultCategory: null,
  notes: null,
  isActive: true,
  createdAt: '2025-01-01',
  transactionCount: 5,
};

const targetPayee: Payee = {
  id: 'p2',
  userId: 'u1',
  name: 'Starbucks',
  defaultCategoryId: 'c1',
  defaultCategory: { id: 'c1', name: 'Food & Drink' } as any,
  notes: null,
  isActive: true,
  createdAt: '2025-01-01',
};

const allPayees = [sourcePayee, targetPayee];

describe('MergePayeeDialog', () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the merge dialog with source payee info', () => {
    render(
      <MergePayeeDialog
        isOpen={true}
        sourcePayee={sourcePayee}
        allPayees={allPayees}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByRole('heading', { name: 'Merge Payee' })).toBeInTheDocument();
    expect(screen.getByText('STARBUCKS #12345')).toBeInTheDocument();
    expect(screen.getByText('5 transactions will be migrated')).toBeInTheDocument();
  });

  it('shows the add as alias checkbox checked by default', () => {
    render(
      <MergePayeeDialog
        isOpen={true}
        sourcePayee={sourcePayee}
        allPayees={allPayees}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('does not render when sourcePayee is null', () => {
    const { container } = render(
      <MergePayeeDialog
        isOpen={true}
        sourcePayee={null}
        allPayees={allPayees}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    expect(container.innerHTML).toBe('');
  });

  it('calls onClose when Cancel is clicked', () => {
    render(
      <MergePayeeDialog
        isOpen={true}
        sourcePayee={sourcePayee}
        allPayees={allPayees}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('disables Merge button when no target is selected', () => {
    render(
      <MergePayeeDialog
        isOpen={true}
        sourcePayee={sourcePayee}
        allPayees={allPayees}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByText('Merge Payee', { selector: 'button' })).toBeDisabled();
  });

  it('filters out source payee from target options', () => {
    render(
      <MergePayeeDialog
        isOpen={true}
        sourcePayee={sourcePayee}
        allPayees={allPayees}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    // The Combobox should show target options that exclude the source
    expect(screen.getByText('Merge into (target payee)')).toBeInTheDocument();
  });
});
