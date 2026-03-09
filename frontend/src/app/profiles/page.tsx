'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { profileApi } from '@/lib/auth';
import { useProfileStore } from '@/store/profileStore';
import { Profile } from '@/types/auth';
import { getErrorMessage } from '@/lib/errors';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#06b6d4',
];

function getInitials(profile: Profile): string {
  const first = profile.firstName.charAt(0).toUpperCase();
  const last = profile.lastName ? profile.lastName.charAt(0).toUpperCase() : '';
  return first + last;
}

export default function ProfilesPage() {
  const router = useRouter();
  const { setProfile } = useProfileStore();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const data = await profileApi.getProfiles();
      setProfiles(data);
    } catch {
      toast.error('Failed to load profiles');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = async (profile: Profile) => {
    setSelecting(profile.id);
    try {
      const selected = await profileApi.selectProfile(profile.id);
      setProfile(selected);
      router.push('/dashboard');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to select profile'));
      setSelecting(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await profileApi.deleteProfile(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      setShowDeleteConfirm(null);
      toast.success('Profile deleted');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete profile'));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 flex items-center gap-3">
        <Image src="/icons/monize-logo.svg" alt="Monize" width={48} height={48} className="rounded-lg" />
        <h1 className="text-4xl font-bold text-white">Monize</h1>
      </div>

      <h2 className="text-xl text-gray-300 mb-10">Who&apos;s managing finances today?</h2>

      <div className="flex flex-wrap justify-center gap-6 max-w-3xl">
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            isSelecting={selecting === profile.id}
            onSelect={() => handleSelect(profile)}
            onEdit={() => setEditingProfile(profile)}
            onDelete={() => setShowDeleteConfirm(profile.id)}
          />
        ))}

        {/* Add profile card */}
        <button
          onClick={() => setShowCreate(true)}
          className="flex flex-col items-center gap-3 group w-28"
        >
          <div className="w-24 h-24 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center group-hover:border-gray-400 transition-colors">
            <svg className="w-10 h-10 text-gray-500 group-hover:text-gray-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className="text-gray-500 group-hover:text-gray-300 text-sm transition-colors">Add Profile</span>
        </button>
      </div>

      {/* Create/Edit modal */}
      {(showCreate || editingProfile) && (
        <ProfileFormModal
          profile={editingProfile}
          onClose={() => { setShowCreate(false); setEditingProfile(null); }}
          onSaved={(saved) => {
            if (editingProfile) {
              setProfiles((prev) => prev.map((p) => p.id === saved.id ? saved : p));
            } else {
              setProfiles((prev) => [...prev, saved]);
            }
            setShowCreate(false);
            setEditingProfile(null);
          }}
        />
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full text-center">
            <h3 className="text-white text-lg font-semibold mb-2">Delete Profile?</h3>
            <p className="text-gray-400 text-sm mb-6">
              This will permanently delete all data associated with this profile. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileCard({
  profile,
  isSelecting,
  onSelect,
  onEdit,
  onDelete,
}: {
  profile: Profile;
  isSelecting: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="relative flex flex-col items-center gap-3 group w-28"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <button
        onClick={onSelect}
        disabled={isSelecting}
        className="w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-bold transition-all hover:ring-4 hover:ring-white/30 hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ backgroundColor: profile.avatarColor }}
      >
        {isSelecting ? (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
        ) : (
          getInitials(profile)
        )}
      </button>

      <span className="text-gray-300 text-sm text-center truncate w-full px-1">
        {profile.firstName}
        {profile.lastName ? ` ${profile.lastName}` : ''}
      </span>

      {/* Actions overlay */}
      {showActions && !isSelecting && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="absolute top-0 right-0 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full p-1 shadow"
          title="Edit profile"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      )}

      {showActions && !isSelecting && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-0 left-0 bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white rounded-full p-1 shadow transition-colors"
          title="Delete profile"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function ProfileFormModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: Profile | null;
  onClose: () => void;
  onSaved: (profile: Profile) => void;
}) {
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [avatarColor, setAvatarColor] = useState(profile?.avatarColor ?? AVATAR_COLORS[0]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return;

    setIsSaving(true);
    try {
      let saved: Profile;
      if (profile) {
        saved = await profileApi.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() || undefined, avatarColor });
      } else {
        saved = await profileApi.createProfile({ firstName: firstName.trim(), lastName: lastName.trim() || undefined, avatarColor });
      }
      onSaved(saved);
      toast.success(profile ? 'Profile updated' : 'Profile created');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save profile'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full">
        <h3 className="text-white text-lg font-semibold mb-4">
          {profile ? 'Edit Profile' : 'Create Profile'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar preview */}
          <div className="flex justify-center mb-2">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: avatarColor }}
            >
              {firstName.charAt(0).toUpperCase() || '?'}
              {lastName.charAt(0).toUpperCase() || ''}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={100}
              required
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="First name"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Last Name (optional)</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={100}
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="Last name"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Avatar Color</label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  className={`w-8 h-8 rounded-full transition-transform ${avatarColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !firstName.trim()}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : (profile ? 'Save' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
