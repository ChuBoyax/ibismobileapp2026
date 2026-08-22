import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { isOfflineSession } from '@/lib/auth-storage';

export function useOfflineSession() {
  const [offline, setOffline] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      isOfflineSession()
        .then((value) => {
          if (active) setOffline(value);
        })
        .catch(() => {});

      return () => {
        active = false;
      };
    }, [])
  );

  return offline;
}
