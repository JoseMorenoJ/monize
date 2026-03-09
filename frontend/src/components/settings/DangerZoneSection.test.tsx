import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/render';
import { DangerZoneSection } from './DangerZoneSection';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/settings',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/auth', () => ({
  profileApi: {
    deleteProfile: vi.fn(),
  },
  authApi: {
    deleteProfile: vi.fn(),
  },
}));

const mockDeselectProfile = vi.fn();
vi.mock('@/store/profileStore', () => ({
  useProfileStore: vi.fn(() => ({
    profile: { id: 'test-profile-id', firstName: 'Test' },
    deselectProfile: mockDeselectProfile,
  })),
}));

vi.mock('@/lib/errors', () => ({
  getErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
}));

import { profileApi } from '@/lib/auth';
import toast from 'react-hot-toast';

describe('DangerZoneSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(profileApi.deleteProfile).mockResolvedValue(undefined);
  });

  it('renders the danger zone heading', () => {
    render(<DangerZoneSection />);
    expect(screen.getByText('Danger Zone')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Profile' })).toBeInTheDocument();
  });

  it('shows confirmation input when Delete Profile is clicked', () => {
    render(<DangerZoneSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Profile' }));
    expect(screen.getByPlaceholderText('Type DELETE')).toBeInTheDocument();
  });

  it('shows error when confirmation text is wrong', async () => {
    render(<DangerZoneSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Profile' }));

    const input = screen.getByPlaceholderText('Type DELETE');
    fireEvent.change(input, { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please type DELETE to confirm');
    });
  });

  it('deletes profile when confirmed', async () => {
    render(<DangerZoneSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Profile' }));

    const input = screen.getByPlaceholderText('Type DELETE');
    fireEvent.change(input, { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }));

    await waitFor(() => {
      expect(profileApi.deleteProfile).toHaveBeenCalledWith('test-profile-id');
      expect(mockDeselectProfile).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/profiles');
    });
  });
});
