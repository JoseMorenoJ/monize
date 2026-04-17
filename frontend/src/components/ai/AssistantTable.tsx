'use client';

import { ReactNode, useRef } from 'react';
import toast from 'react-hot-toast';
import { exportToCsv } from '@/lib/csv-export';

interface AssistantTableProps {
  children: ReactNode;
}

export function AssistantTable({ children }: AssistantTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);

  const handleDownload = () => {
    const table = tableRef.current;
    if (!table) return;

    const headers = Array.from(table.querySelectorAll('thead th')).map(
      (th) => th.textContent?.trim() ?? '',
    );
    const rows = Array.from(table.querySelectorAll('tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('th, td')).map(
        (c) => c.textContent?.trim() ?? '',
      ),
    );

    if (headers.length === 0 && rows.length === 0) {
      toast.error('No table data to export');
      return;
    }

    exportToCsv('ai-table', headers, rows);
  };

  return (
    <div className="my-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleDownload}
          className="p-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Download table as CSV"
          aria-label="Download table as CSV"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </button>
      </div>
      <div className="overflow-x-auto">
        <table ref={tableRef} className="text-xs border-collapse">
          {children}
        </table>
      </div>
    </div>
  );
}
