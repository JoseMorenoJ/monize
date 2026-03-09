import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from './api';
import { profileApi } from './auth';

vi.mock('./api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

describe('profileApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getProfiles fetches all profiles', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: '1', firstName: 'Test' }] });
    const result = await profileApi.getProfiles();
    expect(apiClient.get).toHaveBeenCalledWith('/users');
    expect(result[0].firstName).toBe('Test');
  });

  it('getProfile fetches current profile', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: '1', firstName: 'Test' } });
    const result = await profileApi.getProfile();
    expect(apiClient.get).toHaveBeenCalledWith('/users/me');
    expect(result.firstName).toBe('Test');
  });

  it('selectProfile posts to /users/:id/select', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: '1', firstName: 'Test' } });
    await profileApi.selectProfile('1');
    expect(apiClient.post).toHaveBeenCalledWith('/users/1/select');
  });

  it('deselectProfile posts to /users/deselect', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    await profileApi.deselectProfile();
    expect(apiClient.post).toHaveBeenCalledWith('/users/deselect');
  });

  it('createProfile posts to /users', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: '1', firstName: 'Test' } });
    await profileApi.createProfile({ firstName: 'Test' });
    expect(apiClient.post).toHaveBeenCalledWith('/users', { firstName: 'Test' });
  });

  it('updateProfile patches /users/profile', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { id: '1', firstName: 'Updated' } });
    await profileApi.updateProfile({ firstName: 'Updated' });
    expect(apiClient.patch).toHaveBeenCalledWith('/users/profile', { firstName: 'Updated' });
  });

  it('deleteProfile deletes /users/:id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await profileApi.deleteProfile('1');
    expect(apiClient.delete).toHaveBeenCalledWith('/users/1');
  });
});
