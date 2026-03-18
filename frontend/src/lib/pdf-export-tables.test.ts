import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAutoTable } = vi.hoisted(() => ({
  mockAutoTable: vi.fn(),
}));

vi.mock('jspdf-autotable', () => ({
  default: mockAutoTable,
}));

// Must import AFTER vi.mock
import { addTableToPdf } from './pdf-export-tables';

describe('addTableToPdf', () => {
  beforeEach(() => {
    mockAutoTable.mockClear();
  });

  it('calls autoTable with correct headers and body', () => {
    const mockDoc = {
      lastAutoTable: { finalY: 100 },
    };

    const headers = ['Name', 'Amount'];
    const rows = [
      ['Groceries', 150],
      ['Rent', 1200],
    ];

    const result = addTableToPdf(mockDoc as any, headers, rows, { startY: 40 });

    expect(mockAutoTable).toHaveBeenCalledWith(
      mockDoc,
      expect.objectContaining({
        startY: 40,
        theme: 'grid',
      }),
    );

    const callArgs = mockAutoTable.mock.calls[0][1];
    expect(callArgs.head).toHaveLength(1);
    expect(callArgs.head[0]).toHaveLength(2);
    expect(callArgs.body).toHaveLength(2);
    expect(result).toBe(100);
  });

  it('adds total row when showTotalRow is true', () => {
    const mockDoc = {
      lastAutoTable: { finalY: 120 },
    };

    addTableToPdf(mockDoc as any, ['Name', 'Amount'], [['A', 10]], {
      showTotalRow: true,
      totalRow: ['Total', 10],
    });

    const callArgs = mockAutoTable.mock.calls[0][1];
    // Body should have 2 rows: 1 data + 1 total
    expect(callArgs.body).toHaveLength(2);
  });

  it('right-aligns numeric headers', () => {
    const mockDoc = {
      lastAutoTable: { finalY: 80 },
    };

    addTableToPdf(mockDoc as any, ['Name', 'Amount', 'Count'], [['A', 100, 5]]);

    const callArgs = mockAutoTable.mock.calls[0][1];
    const headerRow = callArgs.head[0];
    // 'Name' should be left-aligned
    expect(headerRow[0].styles.halign).toBe('left');
    // 'Amount' should be right-aligned
    expect(headerRow[1].styles.halign).toBe('right');
    // 'Count' should be right-aligned
    expect(headerRow[2].styles.halign).toBe('right');
  });
});
