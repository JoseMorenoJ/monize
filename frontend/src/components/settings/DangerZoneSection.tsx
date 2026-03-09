'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { profileApi } from '@/lib/auth';
import { useProfileStore } from '@/store/profileStore';
import { getErrorMessage } from '@/lib/errors';

export function DangerZoneSection() {
  const router = useRouter();
  const { profile, deselectProfile } = useProfileStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteProfile = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    if (!profile) return;

    setIsDeleting(true);
    try {
      await profileApi.deleteProfile(profile.id);
      toast.success('Profile deleted');
      deselectProfile();
      router.push('/profiles');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete profile'));
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow dark:shadow-gray-700/50 rounded-lg p-6 border-2 border-red-200 dark:border-red-800">
      <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">Danger Zone</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Once you delete your profile, there is no going back. All associated financial data will be permanently removed.
      </p>

      {!showDeleteConfirm ? (
        <Button
          variant="danger"
          onClick={() => setShowDeleteConfirm(true)}
        >
          Delete Profile
        </Button>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">
            Type DELETE to confirm profile deletion:
          </p>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE"
          />
          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={handleDeleteProfile}
              disabled={isDeleting || deleteConfirmText !== 'DELETE'}
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteConfirmText('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
