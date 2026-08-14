import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { hasPin } from '@/lib/auth-storage';

/**
 * Entry point ng app. Tinitingnan muna kung may naka-set nang PIN:
 * kung meron, diretso sa lock screen; kung wala, sa login form.
 */
export default function Index() {
  const [target, setTarget] = useState<'/lock' | '/login' | null>(null);

  useEffect(() => {
    let active = true;

    hasPin()
      .then((locked) => {
        if (active) setTarget(locked ? '/lock' : '/login');
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
