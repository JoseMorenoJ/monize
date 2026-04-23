import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/render';
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup';
import toast from 'react-hot-toast';

const mockSetupData = {
  secret: 'JBSWY3DPEHPK3PXP',
  qrCodeDataUrl: 'data:image/png;base64,fakeqrcode',
  otpauthUrl: 'otpauth://totp/Monize:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Monize',
};

vi.mock('@/lib/auth', () => ({
  authApi: {
    setup2FA: vi.fn(),
    confirmSetup2FA: vi.fn(),
    generateBackupCodes: vi.fn(),
  },
}));

async function submitPasswordStep(password = 'correct-password') {
  const passwordInput = screen.getByLabelText('Current password');
  fireEvent.change(passwordInput, { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('TwoFactorSetup', () => {
  const onComplete = vi.fn();
  const onSkip = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows password prompt before fetching setup data', async () => {
    render(<TwoFactorSetup onComplete={onComplete} />);

    expect(screen.getByText('Confirm your password')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toBeInTheDocument();
  });

  it('calls setup2FA with the password and displays QR code after confirmation', async () => {
    const { authApi } = await import('@/lib/auth');
    vi.mocked(authApi.setup2FA).mockResolvedValue(mockSetupData);

    render(<TwoFactorSetup onComplete={onComplete} />);
    await submitPasswordStep('my-password');

    await waitFor(() => {
      expect(screen.getByAltText('2FA QR Code')).toBeInTheDocument();
    });
    expect(authApi.setup2FA).toHaveBeenCalledWith('my-password');
    const qrImage = screen.getByAltText('2FA QR Code') as HTMLImageElement;
    expect(qrImage.src).toBe(mockSetupData.qrCodeDataUrl);
  });

  it('shows error toast and stays on password step when password is wrong', async () => {
    const { authApi } = await import('@/lib/auth');
    vi.mocked(authApi.setup2FA).mockRejectedValue({
      response: { data: { message: 'Current password is incorrect' } },
    });

    render(<TwoFactorSetup onComplete={onComplete} />);
    await submitPasswordStep('wrong');

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Current password is incorrect');
    });
    expect(screen.getByText('Confirm your password')).toBeInTheDocument();
    expect(screen.queryByAltText('2FA QR Code')).not.toBeInTheDocument();
  });

  it('toggles manual key display when clicked', async () => {
    const { authApi } = await import('@/lib/auth');
    vi.mocked(authApi.setup2FA).mockResolvedValue(mockSetupData);

    render(<TwoFactorSetup onComplete={onComplete} />);
    await submitPasswordStep();

    await waitFor(() => {
      expect(screen.getByText("Can't scan? Enter key manually")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Can't scan? Enter key manually"));
    expect(screen.getByText(mockSetupData.secret)).toBeInTheDocument();
    expect(screen.getByText('Hide manual key')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Hide manual key'));
    expect(screen.queryByText(mockSetupData.secret)).not.toBeInTheDocument();
  });

  it('filters non-digit characters from code input', async () => {
    const { authApi } = await import('@/lib/auth');
    vi.mocked(authApi.setup2FA).mockResolvedValue(mockSetupData);

    render(<TwoFactorSetup onComplete={onComplete} />);
    await submitPasswordStep();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('000000');
    fireEvent.change(input, { target: { value: '12ab34' } });
    expect(input).toHaveValue('1234');
  });

  it('calls confirmSetup2FA and shows backup codes on successful verification', async () => {
    const { authApi } = await import('@/lib/auth');
    vi.mocked(authApi.setup2FA).mockResolvedValue(mockSetupData);
    vi.mocked(authApi.confirmSetup2FA).mockResolvedValue({ message: 'ok' });
    vi.mocked(authApi.generateBackupCodes).mockResolvedValue({
      codes: ['a1b2-c3d4', 'e5f6-7890'],
    });

    render(<TwoFactorSetup onComplete={onComplete} />);
    await submitPasswordStep();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('000000');
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Verify and Enable'));

    await waitFor(() => {
      expect(authApi.confirmSetup2FA).toHaveBeenCalledWith('123456');
      expect(toast.success).toHaveBeenCalledWith('Two-factor authentication enabled!');
    });

    // Should show backup codes
    await waitFor(() => {
      expect(screen.getByText('Save Your Backup Codes')).toBeInTheDocument();
      expect(screen.getByText('a1b2-c3d4')).toBeInTheDocument();
      expect(screen.getByText('e5f6-7890')).toBeInTheDocument();
    });

    // onComplete not called yet until user clicks Done
    expect(onComplete).not.toHaveBeenCalled();

    // Confirm and click Done
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onComplete).toHaveBeenCalled();
  });

  it('calls onComplete directly if backup code generation fails', async () => {
    const { authApi } = await import('@/lib/auth');
    vi.mocked(authApi.setup2FA).mockResolvedValue(mockSetupData);
    vi.mocked(authApi.confirmSetup2FA).mockResolvedValue({ message: 'ok' });
    vi.mocked(authApi.generateBackupCodes).mockRejectedValue({
      response: { data: { message: 'Service unavailable' } },
    });

    render(<TwoFactorSetup onComplete={onComplete} />);
    await submitPasswordStep();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('000000');
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Verify and Enable'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Service unavailable');
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it('shows error toast on failed verification', async () => {
    const { authApi } = await import('@/lib/auth');
    vi.mocked(authApi.setup2FA).mockResolvedValue(mockSetupData);
    vi.mocked(authApi.confirmSetup2FA).mockRejectedValue({
      response: { data: { message: 'Invalid code' } },
    });

    render(<TwoFactorSetup onComplete={onComplete} />);
    await submitPasswordStep();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('000000');
    fireEvent.change(input, { target: { value: '999999' } });
    fireEvent.click(screen.getByText('Verify and Enable'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid code');
    });
  });

  it('shows skip button on password step when onSkip is provided and not forced', async () => {
    render(<TwoFactorSetup onComplete={onComplete} onSkip={onSkip} isForced={false} />);

    expect(screen.getByText('Skip for now')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Skip for now'));
    expect(onSkip).toHaveBeenCalled();
  });

  it('hides skip button when isForced is true', async () => {
    const { authApi } = await import('@/lib/auth');
    vi.mocked(authApi.setup2FA).mockResolvedValue(mockSetupData);

    render(<TwoFactorSetup onComplete={onComplete} onSkip={onSkip} isForced={true} />);
    await submitPasswordStep();

    await waitFor(() => {
      expect(screen.getByText('Verify and Enable')).toBeInTheDocument();
    });

    expect(screen.queryByText('Skip for now')).not.toBeInTheDocument();
  });
});
