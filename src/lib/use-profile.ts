import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { ApiUser } from '@/lib/api';
import { getProfile } from '@/lib/auth-storage';

/**
 * Binabasa ang naka-cache na profile mula sa huling matagumpay na login.
 * Naka-cache ito kaya may naipapakita agad kahit offline — hindi kailangang
 * maghintay ng network request tuwing bubuksan ang screen.
 */
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

/** Unang letra ng pangalan para sa avatar. */
export function initialOf(name?: string | null) {
  return name?.trim()?.charAt(0)?.toUpperCase() || '?';
}

/** Pinagsasama ang mga barangay ng user para sa subtitle. */
export function barangayLabel(profile: ApiUser | null) {
  if (!profile || profile.barangays.length === 0) return 'No barangay assigned';
  return profile.barangays.map((barangay) => barangay.name.trim()).join(' · ');
}
