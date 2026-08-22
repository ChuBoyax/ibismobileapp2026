import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { ApiUser } from '@/lib/api';
import { getProfile } from '@/lib/auth-storage';

export function useProfile() {
  const [profile, setProfile] = useState<ApiUser | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      getProfile<ApiUser>()
        .then((saved) => {
          if (active) setProfile(saved);
        })
        .catch(() => {
          if (active) setProfile(null);
        });

      return () => {
        active = false;
      };
    }, [])
  );

  return profile;
}

export function initialOf(name?: string | null) {
  return name?.trim()?.charAt(0)?.toUpperCase() || '?';
}
export function barangayLabel(profile: ApiUser | null) {
  if (!profile || profile.barangays.length === 0) return 'No barangay assigned';
  return profile.barangays.map((barangay) => barangay.name.trim()).join(' · ');
}
