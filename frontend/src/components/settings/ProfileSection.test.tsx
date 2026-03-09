import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/render';
import { ProfileSection } from './ProfileSection';
import { Profile } from '@/types/auth';

vi.mock('@/lib/auth', () => ({
  profileApi: {
    updateProfile: vi.fn(),
  },
  authApi: {
    updateProfile: vi.fn(),
  },
}));

vi.mock('@/store/profileStore', () => ({
  useProfileStore: vi.fn(() => ({
    setProfile: vi.fn(),
  })),
}));

vi.mock('@/lib/errors', () => ({
  getErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
}));

import { profileApi } from '@/lib/auth';
import toast from 'react-hot-toast';

const mockProfile: Profile = {
  id: '1',
  firstName: 'John',
  lastName: 'Doe',
  avatarColor: '#6366f1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('ProfileSection', () => {
  const mockOnUserUpdated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(profileApi.updateProfile).mockResolvedValue(mockProfile);
  });

  it('renders the profile form', () => {
    render(<ProfileSection user={mockProfile} onUserUpdated={mockOnUserUpdated} />);
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your first name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your last name')).toBeInTheDocument();
  });

  it('shows avatar preview with initial', () => {
    render(<ProfileSection user={mockProfile} onUserUpdated={mockOnUserUpdated} />);
    // Avatar div should show 'J' (first initial)
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('shows error when no changes made', async () => {
    render(<ProfileSection user={mockProfile} onUserUpdated={mockOnUserUpdated} />);
    const saveButton = screen.getByRole('button', { name: /save profile/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('No changes to save');
    });
  });

  it('submits updated name', async () => {
    render(<ProfileSection user={mockProfile} onUserUpdated={mockOnUserUpdated} />);
    const firstNameInput = screen.getByPlaceholderText('Enter your first name');
    fireEvent.change(firstNameInput, { target: { value: 'Jane' } });

    const saveButton = screen.getByRole('button', { name: /save profile/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(profileApi.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Jane' }));
    });
  });
});
