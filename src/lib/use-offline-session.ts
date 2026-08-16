import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { isOfflineSession } from '@/lib/auth-storage';

/**
 * Pumasok ba ang user nang walang koneksyon?
 *
 * Nire-refresh tuwing babalik ang pokus, dahil nagbabago lang ito pagkatapos
 * mag-login — hindi habang nakatingin ang user sa screen.
 */
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
