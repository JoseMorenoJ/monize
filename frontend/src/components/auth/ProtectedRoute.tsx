'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProfileStore } from '@/store/profileStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useDemoStore } from '@/store/demoStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const { isSelected, _hasHydrated } = useProfileStore();
  const { preferences } = usePreferencesStore();

  useEffect(() => {
    if (_hasHydrated && !isSelected) {
      router.push('/profiles');
    }
  }, [isSelected, _hasHydrated, router]);

  // Set demo mode from preferences (backend sets this via DemoModeGuard)
  useEffect(() => {
    if (preferences) {
      // Demo mode is server-side enforced; no client-side flag needed
      useDemoStore.getState().setDemoMode(false);
    }
  }, [preferences]);

  if (!_hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Loading...</h2>
        </div>
      </div>
    );
  }

  if (!isSelected) {
    return null;
  }

  return <>{children}</>;
}
