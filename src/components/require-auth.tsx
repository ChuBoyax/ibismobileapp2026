import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { getToken } from '@/lib/auth-storage';

type State = 'checking' | 'allowed' | 'denied';

/**
 * Bantay sa mga screen na kailangan ng session sa server.
 *
 * Ang src/app/index.tsx ay ang route na "/" lamang — hindi nito nasasakop
 * ang ibang route. Kung walang ganitong bantay, direktang mabubuksan ang
 * /dashboard o /registration/resident nang walang token: mula sa deep link,
 * o kapag naibalik ng Expo Go ang huling route pagkatapos mag-reload.
 * Ang resulta ay screen na puno ng "Unauthenticated" imbes na login page.
 *
 * Inilalagay ito sa _layout ng bawat protektadong bahagi, kaya isang beses
 * lang ang tsek para sa lahat ng screen sa loob niyon.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    let active = true;

    getToken()
      .then((token) => {
        if (active) setState(token ? 'allowed' : 'denied');
      })
      .catch(() => {
        // Kung hindi mabasa ang storage, mas ligtas ang ipadala sa login
        // kaysa magpakita ng screen na walang datos.
        if (active) setState('denied');
      });

    return () => {
      active = false;
    };
  }, []);

  if (state === 'checking') {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.sealRing}>
          <Image
            source={require('../../assets/images/batologo-256.png')}
            style={styles.seal}
            resizeMode="contain"
          />
        </View>
        <ActivityIndicator color={Colors.onPrimary} />
      </View>
    );
  }

  if (state === 'denied') {
    return <Redirect href="/login" />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxl,
    backgroundColor: Colors.primary,
  },
  sealRing: {
    width: 104,
    height: 104,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seal: {
    width: 84,
    height: 84,
  },
});
