import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@/test/render';
import { screen, fireEvent } from '@testing-library/react';
import { CsvTransferRules } from './CsvTransferRules';
import { CsvTransferRule } from '@/lib/import';

describe('CsvTransferRules', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "No transfer rules" message when rules array is empty', () => {
    render(<CsvTransferRules rules={[]} onChange={onChange} />);

    expect(screen.getByText(/No transfer rules defined/)).toBeInTheDocument();
  });

  it('renders existing rules with correct values', () => {
    const rules: CsvTransferRule[] = [
      { type: 'payee', pattern: 'Transfer', accountName: 'Savings' },
      { type: 'category', pattern: 'Internal', accountName: 'Chequing' },
    ];

    render(<CsvTransferRules rules={rules} onChange={onChange} />);

    const patternInputs = screen.getAllByPlaceholderText('Pattern...');
    const accountInputs = screen.getAllByPlaceholderText('Account name...');

    expect(patternInputs[0]).toHaveValue('Transfer');
    expect(accountInputs[0]).toHaveValue('Savings');
    expect(patternInputs[1]).toHaveValue('Internal');
    expect(accountInputs[1]).toHaveValue('Chequing');
  });

  it('clicking "Add Rule" calls onChange with a new rule appended', () => {
    const existingRules: CsvTransferRule[] = [
      { type: 'payee', pattern: 'Test', accountName: 'Account1' },
    ];

    render(<CsvTransferRules rules={existingRules} onChange={onChange} />);

    fireEvent.click(screen.getByText('Add Rule'));

    expect(onChange).toHaveBeenCalledWith([
      { type: 'payee', pattern: 'Test', accountName: 'Account1' },
      { type: 'payee', pattern: '', accountName: '' },
    ]);
  });

  it('clicking remove button calls onChange with the rule removed', () => {
    const rules: CsvTransferRule[] = [
      { type: 'payee', pattern: 'First', accountName: 'Acc1' },
      { type: 'category', pattern: 'Second', accountName: 'Acc2' },
    ];

    render(<CsvTransferRules rules={rules} onChange={onChange} />);

    const removeButtons = screen.getAllByTitle('Remove rule');
    fireEvent.click(removeButtons[0]);

    expect(onChange).toHaveBeenCalledWith([
      { type: 'category', pattern: 'Second', accountName: 'Acc2' },
    ]);
  });

  it('changing the type dropdown calls onChange with updated type', () => {
    const rules: CsvTransferRule[] = [
      { type: 'payee', pattern: 'Test', accountName: 'Acc1' },
    ];

    render(<CsvTransferRules rules={rules} onChange={onChange} />);

    const select = screen.getByDisplayValue('Payee contains');
    fireEvent.change(select, { target: { value: 'category' } });

    expect(onChange).toHaveBeenCalledWith([
      { type: 'category', pattern: 'Test', accountName: 'Acc1' },
    ]);
  });

  it('changing pattern input calls onChange with updated pattern', () => {
    const rules: CsvTransferRule[] = [
      { type: 'payee', pattern: '', accountName: '' },
    ];

    render(<CsvTransferRules rules={rules} onChange={onChange} />);

    const patternInput = screen.getByPlaceholderText('Pattern...');
    fireEvent.change(patternInput, { target: { value: 'NewPattern' } });

    expect(onChange).toHaveBeenCalledWith([
      { type: 'payee', pattern: 'NewPattern', accountName: '' },
    ]);
  });

  it('changing account name input calls onChange with updated accountName', () => {
    const rules: CsvTransferRule[] = [
      { type: 'payee', pattern: 'Test', accountName: '' },
    ];

    render(<CsvTransferRules rules={rules} onChange={onChange} />);

    const accountInput = screen.getByPlaceholderText('Account name...');
    fireEvent.change(accountInput, { target: { value: 'My Savings' } });

    expect(onChange).toHaveBeenCalledWith([
      { type: 'payee', pattern: 'Test', accountName: 'My Savings' },
    ]);
  });
});
