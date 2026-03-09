'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { PageLayout } from '@/components/layout/PageLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { PreferencesSection } from '@/components/settings/PreferencesSection';
import { DangerZoneSection } from '@/components/settings/DangerZoneSection';
import { userSettingsApi } from '@/lib/user-settings';
import { Profile, UserPreferences } from '@/types/auth';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useDemoStore } from '@/store/demoStore';
import { createLogger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errors';
import Link from 'next/link';

const logger = createLogger('Settings');

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}

function SettingsContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const isDemoMode = useDemoStore((s) => s.isDemoMode);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [userData, prefsData] = await Promise.all([
        userSettingsApi.getProfile(),
        userSettingsApi.getPreferences(),
      ]);
      setUser(userData);
      setPreferences(prefsData);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load settings'));
      logger.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <PageLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-12 pt-6 pb-8">
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner />
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-12 pt-6 pb-8">
        <PageHeader title="Settings" />

        {isDemoMode && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
              Restricted in Demo Mode
            </h2>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Profile editing and profile deletion are disabled in demo mode.
            </p>
          </div>
        )}

        {user && !isDemoMode && (
          <ProfileSection
            user={user}
            onUserUpdated={setUser}
          />
        )}

        {preferences && (
          <PreferencesSection
            preferences={preferences}
            onPreferencesUpdated={setPreferences}
          />
        )}

        {!isDemoMode && (
          <Link
            href="/settings/ai"
            className="block bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              AI Settings
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure AI providers, manage API keys, and view usage statistics.
            </p>
          </Link>
        )}

        {!isDemoMode && <DangerZoneSection />}
      </main>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-8 mb-4">
        v{process.env.NEXT_PUBLIC_APP_VERSION}
      </p>
    </PageLayout>
  );
}
