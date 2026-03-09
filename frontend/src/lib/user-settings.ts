import apiClient from './api';
import {
  Profile,
  UserPreferences,
  UpdateProfileData,
  UpdatePreferencesData,
} from '@/types/auth';

export const userSettingsApi = {
  getProfile: async (): Promise<Profile> => {
    const response = await apiClient.get<Profile>('/users/me');
    return response.data;
  },

  updateProfile: async (data: UpdateProfileData): Promise<Profile> => {
    const response = await apiClient.patch<Profile>('/users/profile', data);
    return response.data;
  },

  getPreferences: async (): Promise<UserPreferences> => {
    const response = await apiClient.get<UserPreferences>('/users/preferences');
    return response.data;
  },

  updatePreferences: async (data: UpdatePreferencesData): Promise<UserPreferences> => {
    const response = await apiClient.patch<UserPreferences>('/users/preferences', data);
    return response.data;
  },
};
