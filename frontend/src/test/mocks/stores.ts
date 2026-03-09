import { useProfileStore } from '@/store/profileStore';

export function setAuthenticatedState() {
  useProfileStore.setState({
    profile: {
      id: 'test-user-id',
      firstName: 'Test',
      lastName: 'User',
      avatarColor: '#6366f1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    isSelected: true,
    _hasHydrated: true,
  });
}

export function resetStores() {
  useProfileStore.getState().deselectProfile();
}
