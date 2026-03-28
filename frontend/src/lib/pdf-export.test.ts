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
  captureAllChartsAsImages: vi.fn().mockResolvedValue([]),
}));

// Mock table rendering
vi.mock('./pdf-export-tables', () => ({
  addTableToPdf: vi.fn().mockReturnValue(100),
}));

// Mock summary cards rendering
const mockAddSummaryCards = vi.fn().mockReturnValue(50);
vi.mock('./pdf-export-cards', () => ({
  addSummaryCardsToPdf: (...args: unknown[]) => mockAddSummaryCards(...args),
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

  it('adds multiple chart images when captureAllChartsAsImages returns multiple', async () => {
    const { captureAllChartsAsImages } = await import('./pdf-export-charts');
    const mockCapture = vi.mocked(captureAllChartsAsImages);
    mockCapture.mockResolvedValueOnce([
      { dataUrl: 'data:image/png;base64,chart1', width: 800, height: 400 },
      { dataUrl: 'data:image/png;base64,chart2', width: 800, height: 400 },
      { dataUrl: 'data:image/png;base64,chart3', width: 800, height: 400 },
    ]);

    const { exportToPdf } = await import('./pdf-export');
    const container = document.createElement('div');

    await exportToPdf({
      title: 'Multi Chart Report',
      chartContainer: container,
      filename: 'multi-chart',
    });

    expect(mockAddImage).toHaveBeenCalledTimes(3);
    expect(mockAddImage).toHaveBeenCalledWith(
      'data:image/png;base64,chart1', 'PNG',
      expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number),
    );
    expect(mockAddImage).toHaveBeenCalledWith(
      'data:image/png;base64,chart2', 'PNG',
      expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number),
    );
    expect(mockAddImage).toHaveBeenCalledWith(
      'data:image/png;base64,chart3', 'PNG',
      expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number),
    );
  });

  it('adds page breaks when charts exceed page height', async () => {
    const { captureAllChartsAsImages } = await import('./pdf-export-charts');
    const mockCapture = vi.mocked(captureAllChartsAsImages);
    // pageHeight is 210mm (landscape A4). With subtitle, currentY starts at 32.
    // maxHeight for multi-chart is 80mm. Each chart takes 80 + 8 = 88mm.
    // After chart 1: currentY = 32 + 80 + 8 = 120
    // Chart 2 needs 80mm, 120 + 80 = 200 > 210 - 20 = 190, so page break
    mockCapture.mockResolvedValueOnce([
      { dataUrl: 'data:image/png;base64,a', width: 400, height: 400 },
      { dataUrl: 'data:image/png;base64,b', width: 400, height: 400 },
    ]);

    const { exportToPdf } = await import('./pdf-export');
    const container = document.createElement('div');

    await exportToPdf({
      title: 'Tall Charts',
      subtitle: 'Testing page breaks',
      chartContainer: container,
      filename: 'tall-charts',
    });

    expect(mockAddPage).toHaveBeenCalled();
    expect(mockAddImage).toHaveBeenCalledTimes(2);
  });

  it('renders summary cards when provided', async () => {
    const { exportToPdf } = await import('./pdf-export');

    const summaryCards = [
      { label: 'Net Worth', value: '$100,000', color: '#16a34a' },
      { label: 'Change', value: '+$5,000', color: '#16a34a' },
    ];

    await exportToPdf({
      title: 'Report with Cards',
      summaryCards,
      filename: 'report-cards',
    });

    expect(mockAddSummaryCards).toHaveBeenCalledWith(
      expect.anything(),
      summaryCards,
      expect.objectContaining({
        startY: expect.any(Number),
        pageWidth: expect.any(Number),
        margin: expect.any(Number),
      }),
    );
  });

  it('does not render summary cards when not provided', async () => {
    mockAddSummaryCards.mockClear();
    const { exportToPdf } = await import('./pdf-export');

    await exportToPdf({
      title: 'Report without Cards',
      filename: 'report-no-cards',
    });

    expect(mockAddSummaryCards).not.toHaveBeenCalled();
  });
});
