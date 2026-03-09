import apiClient from './api';
import { Profile, UpdateProfileData } from '@/types/auth';

export const profileApi = {
  getProfiles: async (): Promise<Profile[]> => {
    const response = await apiClient.get<Profile[]>('/users');
    return response.data;
  },

  getProfile: async (): Promise<Profile> => {
    const response = await apiClient.get<Profile>('/users/me');
    return response.data;
  },

  selectProfile: async (id: string): Promise<Profile> => {
    const response = await apiClient.post<Profile>(`/users/${id}/select`);
    return response.data;
  },

  deselectProfile: async (): Promise<void> => {
    await apiClient.post('/users/deselect');
  },

  createProfile: async (data: { firstName: string; lastName?: string; avatarColor?: string }): Promise<Profile> => {
    const response = await apiClient.post<Profile>('/users', data);
    return response.data;
  },

  updateProfile: async (data: UpdateProfileData): Promise<Profile> => {
    const response = await apiClient.patch<Profile>('/users/profile', data);
    return response.data;
  },

  deleteProfile: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}`);
  },
};

// Backwards compat alias
export const authApi = profileApi;
