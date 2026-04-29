'use client';

import { ReactNode, useRef, useState } from 'react';
import { UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Select } from '@/components/ui/Select';
import { Combobox } from '@/components/ui/Combobox';
import { Transaction } from '@/types/transaction';
import { Account } from '@/types/account';
import { Payee } from '@/types/payee';
import { getCurrencySymbol } from '@/lib/format';
import { buildAccountDropdownOptions } from '@/lib/account-utils';
import { RecentTransactionsPopover } from './RecentTransactionsPopover';

interface NormalTransactionFieldsProps {
  register: UseFormRegister<any>;
  setValue: UseFormSetValue<any>;
  errors: FieldErrors;
  watchedAccountId: string;
  watchedAmount: number;
  watchedCurrencyCode: string;
  watchedPayeeName?: string;
  accounts: Account[];
  selectedPayeeId: string;
  selectedCategoryId: string;
  payees: Payee[];
  payeeAliasMap: Record<string, string[]>;
  categoryOptions: Array<{ value: string; label: string }>;
  handlePayeeChange: (payeeId: string, payeeName: string) => void;
  handlePayeeCreate: (name: string) => void;
  handleCategoryChange: (categoryId: string, name: string) => void;
  handleCategoryCreate: (name: string) => void;
  handleAmountChange: (value: number | undefined) => void;
  handleModeChange: (mode: 'normal' | 'split' | 'transfer') => void;
  /** Quick-fill the form from a previous transaction. When undefined, the
   *  history button is hidden (e.g. when editing). */
  onQuickFill?: (transaction: Transaction) => void;
  transaction?: Transaction;
  createdAtSlot?: ReactNode;
}

export function NormalTransactionFields({
  register,
  setValue,
  errors,
  watchedAccountId,
  watchedAmount,
  watchedCurrencyCode,
  watchedPayeeName,
  accounts,
  selectedPayeeId,
  selectedCategoryId,
  payees,
  payeeAliasMap,
  categoryOptions,
  handlePayeeChange,
  handlePayeeCreate,
  handleCategoryChange,
  handleCategoryCreate,
  handleAmountChange,
  handleModeChange,
  onQuickFill,
  transaction,
  createdAtSlot,
}: NormalTransactionFieldsProps) {
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const [showRecentPopover, setShowRecentPopover] = useState(false);

  return (
    <div className="space-y-4">
      {/* Row 1: Account, Date, and optionally Create Date */}
      <div className={`grid grid-cols-1 gap-4 ${createdAtSlot ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <Select
          label="Account"
          error={errors.accountId?.message as string | undefined}
          value={watchedAccountId || ''}
          options={[
            { value: '', label: 'Select account...' },
            ...buildAccountDropdownOptions(
              accounts,
              (account) =>
                account.accountSubType !== 'INVESTMENT_BROKERAGE' &&
                (!account.isClosed || account.id === watchedAccountId),
            ),
          ]}
          {...register('accountId')}
        />
        <DateInput
          label="Date"
          error={errors.transactionDate?.message as string | undefined}
          onDateChange={(date) => setValue('transactionDate', date, { shouldDirty: true, shouldValidate: true })}
          {...register('transactionDate')}
        />
        {createdAtSlot}
      </div>

      {/* Row 2: Payee and Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-end space-x-2">
          <div className="flex-1 min-w-0">
            <Combobox
              label="Payee"
              placeholder="Select or type payee name..."
              options={payees.map(payee => ({
                value: payee.id,
                label: payee.name,
                subtitle: payee.defaultCategory?.name,
                keywords: payeeAliasMap[payee.id],
              }))}
              value={selectedPayeeId}
              initialDisplayValue={transaction?.payeeName || ''}
              onChange={handlePayeeChange}
              onCreateNew={handlePayeeCreate}
              allowCustomValue={true}
              error={errors.payeeName?.message as string | undefined}
            />
          </div>
          {onQuickFill && (
            <button
              ref={historyButtonRef}
              type="button"
              onClick={() => setShowRecentPopover((v) => !v)}
              aria-label={
                selectedPayeeId || watchedPayeeName
                  ? 'Show recent transactions for this payee'
                  : 'Show recent transactions'
              }
              aria-haspopup="dialog"
              aria-expanded={showRecentPopover}
              title="Quick fill from a recent transaction"
              className="flex-shrink-0 px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .2.08.39.22.53l3 3a.75.75 0 101.06-1.06L10.75 9.69V5z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
          {showRecentPopover && onQuickFill && (
            <RecentTransactionsPopover
              anchorRef={historyButtonRef}
              payeeId={selectedPayeeId || undefined}
              payeeName={selectedPayeeId ? undefined : watchedPayeeName || undefined}
              onSelect={(t) => {
                onQuickFill(t);
                setShowRecentPopover(false);
              }}
              onClose={() => setShowRecentPopover(false)}
            />
          )}
        </div>
        <div>
          <div className="flex items-end sm:space-x-2">
            <div className="flex-1">
              <Combobox
                label="Category"
                placeholder="Select or create category..."
                options={categoryOptions}
                value={selectedCategoryId}
                initialDisplayValue={transaction?.category?.name || ''}
                onChange={handleCategoryChange}
                onCreateNew={handleCategoryCreate}
                allowCustomValue={true}
                error={errors.categoryId?.message as string | undefined}
              />
            </div>
            <button
              type="button"
              onClick={() => handleModeChange('split')}
              className="hidden sm:block px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 whitespace-nowrap"
            >
              Split Transaction
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleModeChange('split')}
            className="sm:hidden mt-2 w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            Split Transaction
          </button>
        </div>
      </div>

      {/* Row 3: Amount and Reference Number */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CurrencyInput
          label="Amount"
          prefix={getCurrencySymbol(watchedCurrencyCode)}
          value={watchedAmount}
          onChange={handleAmountChange}
          error={errors.amount?.message as string | undefined}
        />
        <Input
          label="Reference Number"
          type="text"
          placeholder="Cheque #, confirmation #..."
          error={errors.referenceNumber?.message as string | undefined}
          {...register('referenceNumber')}
        />
      </div>
    </div>
  );
}
