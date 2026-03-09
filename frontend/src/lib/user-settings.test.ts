import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from './api';
import { userSettingsApi } from './user-settings';

vi.mock('./api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('userSettingsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getProfile fetches /users/me', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 'u-1', firstName: 'Test' } });
    const result = await userSettingsApi.getProfile();
    expect(apiClient.get).toHaveBeenCalledWith('/users/me');
    expect(result.firstName).toBe('Test');
  });

  it('updateProfile patches /users/profile', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { id: 'u-1' } });
    await userSettingsApi.updateProfile({ firstName: 'Updated' });
    expect(apiClient.patch).toHaveBeenCalledWith('/users/profile', { firstName: 'Updated' });
  });

  it('getPreferences fetches /users/preferences', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { theme: 'dark' } });
    const result = await userSettingsApi.getPreferences();
    expect(apiClient.get).toHaveBeenCalledWith('/users/preferences');
    expect(result.theme).toBe('dark');
  });

  it('updatePreferences patches /users/preferences', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { theme: 'light' } });
    await userSettingsApi.updatePreferences({ theme: 'light' });
    expect(apiClient.patch).toHaveBeenCalledWith('/users/preferences', { theme: 'light' });
  });
});
