import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/render';
import { BackupRestoreSection } from './BackupRestoreSection';

vi.mock('@/lib/backupApi', () => ({
  backupApi: {
    exportBackup: vi.fn(),
    restoreBackup: vi.fn(),
  },
}));

vi.mock('@/lib/errors', () => ({
  getErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
}));

import { backupApi } from '@/lib/backupApi';
import toast from 'react-hot-toast';

describe('BackupRestoreSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders backup and restore sections', () => {
    render(<BackupRestoreSection />);

    expect(screen.getByText('Backup & Restore')).toBeInTheDocument();
    expect(screen.getByText('Create Backup')).toBeInTheDocument();
    expect(screen.getByText('Restore from Backup')).toBeInTheDocument();
    expect(screen.getByText('Download Backup')).toBeInTheDocument();
    expect(screen.getByText('Restore from Backup...')).toBeInTheDocument();
  });

  it('downloads backup when export button clicked', async () => {
    const mockBlob = new Blob(['{}'], { type: 'application/json' });
    (backupApi.exportBackup as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlob);

    const mockUrl = 'blob:http://localhost/mock-url';
    const createObjectURL = vi.fn().mockReturnValue(mockUrl);
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    render(<BackupRestoreSection />);

    fireEvent.click(screen.getByText('Download Backup'));

    await waitFor(() => {
      expect(backupApi.exportBackup).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Backup downloaded successfully');
    });
  });

  it('shows error toast on export failure', async () => {
    (backupApi.exportBackup as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Export failed'),
    );

    render(<BackupRestoreSection />);

    fireEvent.click(screen.getByText('Download Backup'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to create backup');
    });
  });

  it('expands restore form when button clicked', () => {
    render(<BackupRestoreSection />);

    fireEvent.click(screen.getByText('Restore from Backup...'));

    expect(screen.getByText('Select backup file')).toBeInTheDocument();
    expect(screen.getByText('Confirm Restore')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('collapses restore form on cancel', () => {
    render(<BackupRestoreSection />);

    fireEvent.click(screen.getByText('Restore from Backup...'));
    expect(screen.getByText('Confirm Restore')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Confirm Restore')).not.toBeInTheDocument();
  });

  it('disables confirm button without file', () => {
    render(<BackupRestoreSection />);

    fireEvent.click(screen.getByText('Restore from Backup...'));

    const confirmButton = screen.getByText('Confirm Restore');
    expect(confirmButton).toBeDisabled();
  });

  it('restores backup successfully by sending file to API', async () => {
    (backupApi.restoreBackup as ReturnType<typeof vi.fn>).mockResolvedValue({
      message: 'Backup restored successfully',
      restored: { categories: 5, accounts: 3 },
    });

    render(<BackupRestoreSection />);

    fireEvent.click(screen.getByText('Restore from Backup...'));

    const backupContent = JSON.stringify({ version: 1, exportedAt: '2026-01-01' });
    const file = new File([backupContent], 'backup.json', { type: 'application/json' });
    const fileInput = screen.getByLabelText('Select backup file') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText('Confirm Restore'));

    await waitFor(() => {
      expect(backupApi.restoreBackup).toHaveBeenCalledWith({
        file: expect.any(File),
      });
      expect(toast.success).toHaveBeenCalledWith('Restored 8 records successfully');
    });
  });

  it('shows error toast on restore failure', async () => {
    (backupApi.restoreBackup as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Server error'),
    );

    render(<BackupRestoreSection />);

    fireEvent.click(screen.getByText('Restore from Backup...'));

    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    const fileInput = screen.getByLabelText('Select backup file') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText('Confirm Restore'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to restore backup');
    });
  });
});
