'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Transaction, BulkUpdateData, BulkUpdateFilters } from '@/types/transaction';

interface UseTransactionSelectionReturn {
  selectedIds: Set<string>;
  excludedIds: Set<string>;
  selectAllMatching: boolean;
  isAllOnPageSelected: boolean;
  selectionCount: number;
  isTransactionSelected: (id: string) => boolean;
  toggleTransaction: (id: string) => void;
  toggleAllOnPage: () => void;
  selectAllMatchingTransactions: () => void;
  clearSelection: () => void;
  hasSelection: boolean;
  buildSelectionPayload: () => Pick<BulkUpdateData, 'mode' | 'transactionIds' | 'filters' | 'excludedIds'>;
}

export function useTransactionSelection(
  transactions: Transaction[],
  totalMatching: number,
  currentFilters: BulkUpdateFilters,
): UseTransactionSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  // Track filter changes to clear selection
  const filtersRef = useRef(currentFilters);
  /* eslint-disable react-hooks/set-state-in-effect -- clearing selection when filters change */
  useEffect(() => {
    const prev = filtersRef.current;
    const changed =
      JSON.stringify(prev) !== JSON.stringify(currentFilters);
    if (changed) {
      setSelectedIds(new Set());
      setExcludedIds(new Set());
      setSelectAllMatching(false);
      filtersRef.current = currentFilters;
    }
  }, [currentFilters]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Clear individual selections on page change (but not selectAllMatching/excludedIds,
  // which span all pages).
  const transactionIdsKey = transactions.map(t => t.id).join(',');
  const prevTransactionIdsKey = useRef(transactionIdsKey);
  /* eslint-disable react-hooks/set-state-in-effect -- clearing selection on page change */
  useEffect(() => {
    if (prevTransactionIdsKey.current !== transactionIdsKey && !selectAllMatching) {
      setSelectedIds(new Set());
    }
    prevTransactionIdsKey.current = transactionIdsKey;
  }, [transactionIdsKey, selectAllMatching]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const isTransactionSelected = useCallback((id: string): boolean => {
    if (selectAllMatching) return !excludedIds.has(id);
    return selectedIds.has(id);
  }, [selectAllMatching, excludedIds, selectedIds]);

  const isAllOnPageSelected = useMemo(() => {
    if (transactions.length === 0) return false;
    if (selectAllMatching) {
      return transactions.every(t => !excludedIds.has(t.id));
    }
    return transactions.every(t => selectedIds.has(t.id));
  }, [transactions, selectedIds, selectAllMatching, excludedIds]);

  const selectionCount = selectAllMatching
    ? Math.max(0, totalMatching - excludedIds.size)
    : selectedIds.size;

  const hasSelection = selectionCount > 0;

  const toggleTransaction = useCallback((id: string) => {
    if (selectAllMatching) {
      // In all-matching mode, toggling moves the id in/out of the exclusion set
      // while preserving the all-matching scope across pages.
      setExcludedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      return;
    }

    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [selectAllMatching]);

  const toggleAllOnPage = useCallback(() => {
    if (selectAllMatching) {
      const anyExcludedOnPage = transactions.some(t => excludedIds.has(t.id));
      setExcludedIds(prev => {
        const next = new Set(prev);
        if (anyExcludedOnPage) {
          // Re-include all on page
          for (const t of transactions) {
            next.delete(t.id);
          }
        } else {
          // Exclude all on page
          for (const t of transactions) {
            next.add(t.id);
          }
        }
        return next;
      });
      return;
    }

    if (isAllOnPageSelected) {
      // Deselect all on page
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const t of transactions) {
          next.delete(t.id);
        }
        return next;
      });
    } else {
      // Select all on page
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const t of transactions) {
          next.add(t.id);
        }
        return next;
      });
    }
  }, [isAllOnPageSelected, selectAllMatching, transactions, excludedIds]);

  const selectAllMatchingTransactions = useCallback(() => {
    setSelectAllMatching(true);
    setExcludedIds(new Set());
    setSelectedIds(new Set(transactions.map(t => t.id)));
  }, [transactions]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setExcludedIds(new Set());
    setSelectAllMatching(false);
  }, []);

  const buildSelectionPayload = useCallback((): Pick<BulkUpdateData, 'mode' | 'transactionIds' | 'filters' | 'excludedIds'> => {
    if (selectAllMatching) {
      return {
        mode: 'filter',
        filters: currentFilters,
        ...(excludedIds.size > 0 ? { excludedIds: Array.from(excludedIds) } : {}),
      };
    }
    return {
      mode: 'ids',
      transactionIds: Array.from(selectedIds),
    };
  }, [selectAllMatching, selectedIds, excludedIds, currentFilters]);

  return {
    selectedIds,
    excludedIds,
    selectAllMatching,
    isAllOnPageSelected,
    selectionCount,
    isTransactionSelected,
    toggleTransaction,
    toggleAllOnPage,
    selectAllMatchingTransactions,
    clearSelection,
    hasSelection,
    buildSelectionPayload,
  };
}
