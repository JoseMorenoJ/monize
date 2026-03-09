import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AxiosError } from 'axios';
import { Profile } from '@/types/auth';
import { clearAllCache } from '@/lib/apiCache';

interface ProfileState {
  profile: Profile | null;
  isSelected: boolean;
  _hasHydrated: boolean;
  setProfile: (profile: Profile | null) => void;
  setHasHydrated: (state: boolean) => void;
  deselectProfile: () => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: null,
      isSelected: false,
      _hasHydrated: false,

      setProfile: (profile) => set({ profile, isSelected: !!profile }),

      deselectProfile: () => {
        clearAllCache();
        import('@/store/preferencesStore').then(({ usePreferencesStore }) => {
          usePreferencesStore.getState().clearPreferences();
        });
        set({ profile: null, isSelected: false });
      },

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'profile-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ isSelected: state.isSelected }),
      onRehydrateStorage: () => (state) => {
        if (state?.isSelected) {
          import('@/lib/auth').then(({ profileApi }) => {
            profileApi.getProfile().then((profile: Profile) => {
              state.setProfile(profile);
              state.setHasHydrated(true);
            }).catch((error: unknown) => {
              const status = error instanceof AxiosError ? error.response?.status : undefined;
              if (status === 502 || (error instanceof AxiosError && !error.response)) {
                import('@/store/connectionStore').then(({ useConnectionStore }) => {
                  useConnectionStore.getState().setBackendDown();
                });
                state.setHasHydrated(true);
              } else {
                state.deselectProfile();
                state.setHasHydrated(true);
              }
            });
          });
        } else {
          state?.setHasHydrated(true);
        }
      },
    }
  )
);
