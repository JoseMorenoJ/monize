import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/render';
import { BackupCodesDisplay } from '@/components/auth/BackupCodesDisplay';

const mockCodes = [
  'a1b2-c3d4',
  'e5f6-7890',
  'abcd-ef12',
  '3456-7890',
  'dead-beef',
  'cafe-babe',
  '1234-5678',
  '9abc-def0',
  'face-b00c',
  '0123-4567',
  '89ab-cdef',
  'f00d-cafe',
];

describe('BackupCodesDisplay', () => {
  const onDone = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders all backup codes', () => {
    render(<BackupCodesDisplay codes={mockCodes} onDone={onDone} />);

    expect(screen.getByText('Save Your Backup Codes')).toBeInTheDocument();
    for (const code of mockCodes) {
      expect(screen.getByText(code)).toBeInTheDocument();
    }
  });

  it('shows warning about saving codes', () => {
    render(<BackupCodesDisplay codes={mockCodes} onDone={onDone} />);

    expect(screen.getByText(/Store these codes in a safe place/)).toBeInTheDocument();
    expect(screen.getByText(/You will not be able to see them again/)).toBeInTheDocument();
  });

  it('disables Done button until confirmation checkbox is checked', () => {
    render(<BackupCodesDisplay codes={mockCodes} onDone={onDone} />);

    const doneButton = screen.getByRole('button', { name: 'Done' });
    expect(doneButton).toBeDisabled();

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(doneButton).not.toBeDisabled();
  });

  it('calls onDone when Done button is clicked after confirmation', () => {
    render(<BackupCodesDisplay codes={mockCodes} onDone={onDone} />);

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onDone).toHaveBeenCalled();
  });

  it('copies codes to clipboard when Copy button is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(<BackupCodesDisplay codes={mockCodes} onDone={onDone} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy codes' }));

    expect(writeText).toHaveBeenCalledWith(mockCodes.join('\n'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    });
  });

  it('triggers download when Download button is clicked', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:test');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });

    render(<BackupCodesDisplay codes={mockCodes} onDone={onDone} />);

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  it('renders each code can only be used once message', () => {
    render(<BackupCodesDisplay codes={mockCodes} onDone={onDone} />);

    expect(screen.getByText(/Each code can only be used once/)).toBeInTheDocument();
  });
});
