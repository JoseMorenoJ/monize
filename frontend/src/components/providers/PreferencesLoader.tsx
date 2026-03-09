'use client';

import { useEffect } from 'react';
import { useProfileStore } from '@/store/profileStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Component that loads user preferences when a profile session is active.
 * Should be placed inside the app layout.
 */
export function PreferencesLoader({ children }: { children: React.ReactNode }) {
  const isSelected = useProfileStore((state) => state.isSelected);
  const profileHydrated = useProfileStore((state) => state._hasHydrated);
  const loadPreferences = usePreferencesStore((state) => state.loadPreferences);
  const clearPreferences = usePreferencesStore((state) => state.clearPreferences);
  const preferences = usePreferencesStore((state) => state.preferences);
  const isLoaded = usePreferencesStore((state) => state.isLoaded);
  const prefsHydrated = usePreferencesStore((state) => state._hasHydrated);
  const { setTheme } = useTheme();

  useEffect(() => {
    // Wait for both stores to hydrate
    if (!profileHydrated || !prefsHydrated) return;

    if (isSelected && !isLoaded) {
      loadPreferences();
    } else if (!isSelected) {
      clearPreferences();
    }
  }, [isSelected, profileHydrated, prefsHydrated, isLoaded, loadPreferences, clearPreferences]);

  // Sync theme when preferences change
  useEffect(() => {
    if (prefsHydrated && preferences?.theme) {
      setTheme(preferences.theme as 'light' | 'dark' | 'system');
    }
  }, [prefsHydrated, preferences?.theme, setTheme]);

  return <>{children}</>;
}
