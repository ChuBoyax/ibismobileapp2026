import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { getToken, hasPin } from '@/lib/auth-storage';

type Target = '/lock' | '/login' | '/dashboard';

/**
 * Entry point ng app.
 *
 * Dalawang magkaibang bagay ang tinitingnan dito:
 *
 *  • Ang API token — ito ang session sa server. Kung wala, walang datos na
 *    makukuha kahit gaano pa kahusay ang lokal na seguridad.
 *  • Ang PIN — lokal na kandado lang ng device. Hindi ito nagpapatunay ng
 *    sinuman sa backend.
 *
 * Kaya kailangan munang may token bago pa man isipin ang PIN. Kung wala,
 * diretso sa buong password login — kahit may naka-set nang PIN.
 */
export default function Index() {
  const [target, setTarget] = useState<Target | null>(null);

  useEffect(() => {
    let active = true;

    async function decide(): Promise<Target> {
      const token = await getToken();

      if (!token) return '/login';

      return (await hasPin()) ? '/lock' : '/dashboard';
    }

    decide()
      .then((next) => {
        if (active) setTarget(next);
      })
      .catch(() => {
        // Kung may problema sa storage, huwag i-lock ang user sa labas.
        if (active) setTarget('/login');
      });

    return () => {
      active = false;
    };
  }, []);

  if (!target) {
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

  return <Redirect href={target} />;
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
