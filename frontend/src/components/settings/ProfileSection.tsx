'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import '@/lib/zodConfig';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { profileApi } from '@/lib/auth';
import { useProfileStore } from '@/store/profileStore';
import { Profile, UpdateProfileData } from '@/types/auth';
import { getErrorMessage } from '@/lib/errors';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#06b6d4',
];

const profileSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be 100 characters or less'),
  lastName: z
    .string()
    .max(100, 'Last name must be 100 characters or less')
    .optional()
    .or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileSectionProps {
  user: Profile;
  onUserUpdated: (user: Profile) => void;
}

export function ProfileSection({ user, onUserUpdated }: ProfileSectionProps) {
  const { setProfile } = useProfileStore();
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [avatarColor, setAvatarColor] = useState(user.avatarColor ?? '#6366f1');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
    },
  });

  const watchedFirstName = watch('firstName');

  const onSubmit = async (formData: ProfileFormData) => {
    setIsUpdatingProfile(true);
    try {
      const data: UpdateProfileData = {};
      if (formData.firstName !== (user.firstName || '')) data.firstName = formData.firstName;
      if (formData.lastName !== (user.lastName || '')) data.lastName = formData.lastName || undefined;
      if (avatarColor !== user.avatarColor) data.avatarColor = avatarColor;

      if (Object.keys(data).length === 0) {
        toast.error('No changes to save');
        return;
      }

      const updatedUser = await profileApi.updateProfile(data);
      onUserUpdated(updatedUser);
      setProfile(updatedUser);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update profile'));
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow dark:shadow-gray-700/50 rounded-lg p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Profile</h2>
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Avatar preview */}
        <div className="flex justify-center mb-6">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold"
            style={{ backgroundColor: avatarColor }}
          >
            {(watchedFirstName || user.firstName).charAt(0).toUpperCase()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="First Name"
            {...register('firstName')}
            error={errors.firstName?.message}
            placeholder="Enter your first name"
          />
          <Input
            label="Last Name"
            {...register('lastName')}
            error={errors.lastName?.message}
            placeholder="Enter your last name"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Avatar Color
          </label>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setAvatarColor(color)}
                className={`w-8 h-8 rounded-full transition-transform ${
                  avatarColor === color
                    ? 'ring-2 ring-blue-500 ring-offset-2 scale-110'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={isUpdatingProfile}>
            {isUpdatingProfile ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </form>
    </div>
  );
}
