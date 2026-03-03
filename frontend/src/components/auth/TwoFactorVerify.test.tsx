import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/render';
import { TwoFactorVerify } from '@/components/auth/TwoFactorVerify';
import toast from 'react-hot-toast';

vi.mock('@/lib/auth', () => ({
  authApi: {
    verify2FA: vi.fn(),
  },
}));

describe('TwoFactorVerify', () => {
  const onVerified = vi.fn();
  const onCancel = vi.fn();
  const tempToken = 'temp-token-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the verification form with title and input', () => {
    render(
      <TwoFactorVerify tempToken={tempToken} onVerified={onVerified} onCancel={onCancel} />,
    );

    expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
    expect(screen.getByLabelText('Verification Code')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
  });

  it('filters non-digit characters from input', () => {
    render(
      <TwoFactorVerify tempToken={tempToken} onVerified={onVerified} onCancel={onCancel} />,
    );

    const input = screen.getByPlaceholderText('000000');
    fireEvent.change(input, { target: { value: 'abc123def456' } });
    expect(input).toHaveValue('123456');
  });

  it('renders remember device checkbox', () => {
    render(
      <TwoFactorVerify tempToken={tempToken} onVerified={onVerified} onCancel={onCancel} />,
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('calls verify2FA with correct params on submit', async () => {
    const { authApi } = await import('@/lib/auth');
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      authProvider: 'local' as const,
      hasPassword: true,
      role: 'user' as const,
      isActive: true,
      mustChangePassword: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    vi.mocked(authApi.verify2FA).mockResolvedValue({ user: mockUser });

    render(
      <TwoFactorVerify tempToken={tempToken} onVerified={onVerified} onCancel={onCancel} />,
    );

    const input = screen.getByPlaceholderText('000000');
    fireEvent.change(input, { target: { value: '654321' } });

    // Check remember device
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByText('Verify'));

    await waitFor(() => {
      expect(authApi.verify2FA).toHaveBeenCalledWith(tempToken, '654321', true);
      expect(onVerified).toHaveBeenCalledWith(mockUser);
    });
  });

  it('shows error toast and clears code on failed verification', async () => {
    const { authApi } = await import('@/lib/auth');
    vi.mocked(authApi.verify2FA).mockRejectedValue({
      response: { data: { message: 'Code expired' } },
    });

    render(
      <TwoFactorVerify tempToken={tempToken} onVerified={onVerified} onCancel={onCancel} />,
    );

    const input = screen.getByPlaceholderText('000000');
    fireEvent.change(input, { target: { value: '111111' } });
    fireEvent.click(screen.getByText('Verify'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Code expired');
      expect(input).toHaveValue('');
    });
  });

  it('disables Verify button when code is less than 6 digits', () => {
    render(
      <TwoFactorVerify tempToken={tempToken} onVerified={onVerified} onCancel={onCancel} />,
    );

    const verifyButton = screen.getByText('Verify');
    expect(verifyButton).toBeDisabled();

    const input = screen.getByPlaceholderText('000000');
    fireEvent.change(input, { target: { value: '123' } });
    expect(verifyButton).toBeDisabled();

    fireEvent.change(input, { target: { value: '123456' } });
    expect(verifyButton).not.toBeDisabled();
  });

  it('calls onCancel when back to login is clicked', () => {
    render(
      <TwoFactorVerify tempToken={tempToken} onVerified={onVerified} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByText('Back to login'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows backup code toggle link', () => {
    render(
      <TwoFactorVerify tempToken={tempToken} onVerified={onVerified} onCancel={onCancel} />,
    );

    expect(screen.getByText('Use a backup code instead')).toBeInTheDocument();
  });

  it('switches to backup code mode when toggled', () => {
    render(
      <TwoFactorVerify tempToken={tempToken} onVerified={onVerified} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByText('Use a backup code instead'));

    expect(screen.getByLabelText('Backup Code')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('xxxx-xxxx')).toBeInTheDocument();
    expect(screen.getByText('Enter one of your backup codes.')).toBeInTheDocument();
    expect(screen.getByText('Use authenticator code instead')).toBeInTheDocument();
  });

  it('switches back to TOTP mode from backup code mode', () => {
    render(
      <TwoFactorVerify tempToken={tempToken} onVerified={onVerified} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByText('Use a backup code instead'));
    expect(screen.getByLabelText('Backup Code')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Use authenticator code instead'));
    expect(screen.getByLabelText('Verification Code')).toBeInTheDocument();
  });

  it('submits backup code with correct format', async () => {
    const { authApi } = await import('@/lib/auth');
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      authProvider: 'local' as const,
      hasPassword: true,
      role: 'user' as const,
      isActive: true,
      mustChangePassword: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    vi.mocked(authApi.verify2FA).mockResolvedValue({ user: mockUser });

    render(
      <TwoFactorVerify tempToken={tempToken} onVerified={onVerified} onCancel={onCancel} />,
    );

    // Switch to backup code mode
    fireEvent.click(screen.getByText('Use a backup code instead'));

    const input = screen.getByPlaceholderText('xxxx-xxxx');
    fireEvent.change(input, { target: { value: 'a1b2-c3d4' } });
    fireEvent.click(screen.getByText('Verify'));

    await waitFor(() => {
      expect(authApi.verify2FA).toHaveBeenCalledWith(tempToken, 'a1b2-c3d4', false);
      expect(onVerified).toHaveBeenCalledWith(mockUser);
    });
  });

  it('disables Verify button when backup code format is invalid', () => {
    render(
      <TwoFactorVerify tempToken={tempToken} onVerified={onVerified} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByText('Use a backup code instead'));

    const verifyButton = screen.getByText('Verify');
    expect(verifyButton).toBeDisabled();

    const input = screen.getByPlaceholderText('xxxx-xxxx');
    fireEvent.change(input, { target: { value: 'a1b2' } });
    expect(verifyButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'a1b2-c3d4' } });
    expect(verifyButton).not.toBeDisabled();
  });
});
