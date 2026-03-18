import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock jspdf
const mockSave = vi.fn();
const mockText = vi.fn();
const mockAddImage = vi.fn();
const mockSetFontSize = vi.fn();
const mockSetFont = vi.fn();
const mockSetTextColor = vi.fn();
const mockSetDrawColor = vi.fn();
const mockSetLineWidth = vi.fn();
const mockLine = vi.fn();
const mockAddPage = vi.fn();
const mockSetPage = vi.fn();
const mockGetNumberOfPages = vi.fn().mockReturnValue(1);

vi.mock('jspdf', () => {
  class MockJsPDF {
    save = mockSave;
    text = mockText;
    addImage = mockAddImage;
    setFontSize = mockSetFontSize;
    setFont = mockSetFont;
    setTextColor = mockSetTextColor;
    setDrawColor = mockSetDrawColor;
    setLineWidth = mockSetLineWidth;
    line = mockLine;
    addPage = mockAddPage;
    setPage = mockSetPage;
    getNumberOfPages = mockGetNumberOfPages;
    internal = {
      pageSize: { getWidth: () => 297, getHeight: () => 210 },
    };
  }
  return { jsPDF: MockJsPDF };
});

// Mock chart capture
vi.mock('./pdf-export-charts', () => ({
  captureSvgAsImage: vi.fn().mockResolvedValue(null),
}));

// Mock table rendering
vi.mock('./pdf-export-tables', () => ({
  addTableToPdf: vi.fn().mockReturnValue(100),
}));

describe('exportToPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a PDF with title and saves it', async () => {
    const { exportToPdf } = await import('./pdf-export');

    await exportToPdf({
      title: 'Test Report',
      filename: 'test-report',
    });

    expect(mockText).toHaveBeenCalledWith('Test Report', expect.any(Number), expect.any(Number));
    expect(mockSave).toHaveBeenCalledWith('test-report.pdf');
  });

  it('appends .pdf extension if missing', async () => {
    const { exportToPdf } = await import('./pdf-export');

    await exportToPdf({
      title: 'Report',
      filename: 'my-report',
    });

    expect(mockSave).toHaveBeenCalledWith('my-report.pdf');
  });

  it('does not double .pdf extension', async () => {
    const { exportToPdf } = await import('./pdf-export');

    await exportToPdf({
      title: 'Report',
      filename: 'my-report.pdf',
    });

    expect(mockSave).toHaveBeenCalledWith('my-report.pdf');
  });

  it('includes subtitle when provided', async () => {
    const { exportToPdf } = await import('./pdf-export');

    await exportToPdf({
      title: 'Report',
      subtitle: 'Jan 2024 - Dec 2024',
      filename: 'report',
    });

    expect(mockText).toHaveBeenCalledWith(
      'Jan 2024 - Dec 2024',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('renders table data when provided', async () => {
    const { exportToPdf } = await import('./pdf-export');
    const { addTableToPdf } = await import('./pdf-export-tables');

    await exportToPdf({
      title: 'Report',
      tableData: {
        headers: ['Name', 'Value'],
        rows: [['A', 100]],
      },
      filename: 'report',
    });

    expect(addTableToPdf).toHaveBeenCalled();
  });

  it('adds page numbers to footer', async () => {
    const { exportToPdf } = await import('./pdf-export');

    await exportToPdf({
      title: 'Report',
      filename: 'report',
    });

    // Should call setPage for footer
    expect(mockSetPage).toHaveBeenCalledWith(1);
    // Should have "Monize" and page number in footer
    expect(mockText).toHaveBeenCalledWith('Monize', expect.any(Number), expect.any(Number));
    expect(mockText).toHaveBeenCalledWith(
      'Page 1 of 1',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: 'right' }),
    );
  });
});
