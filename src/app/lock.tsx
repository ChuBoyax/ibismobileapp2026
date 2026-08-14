import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PinPad } from '@/components/pin-pad';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import {
  MAX_PIN_ATTEMPTS,
  PIN_LENGTH,
  clearSecurity,
  getAttempts,
  getSavedEmail,
  isBiometricEnabled,
  resetAttempts,
  setAttempts,
  verifyPin,
} from '@/lib/auth-storage';
import { authenticate, getBiometricSupport, type BiometricSupport } from '@/lib/biometrics';

export default function LockScreen() {
  const insets = useSafeAreaInsets();

  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttemptCount] = useState(0);
  const [email, setEmail] = useState('');
  const [biometric, setBiometric] = useState<BiometricSupport | null>(null);
  const [biometricOn, setBiometricOn] = useState(false);

  // Para minsan lang mag-prompt ang fingerprint pagbukas ng screen.
  const promptedRef = useRef(false);

  const runBiometric = useCallback(async () => {
    const ok = await authenticate('Unlock IBIS');
    if (ok) {
      await resetAttempts();
      router.replace('/dashboard');
    }
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      const [savedEmail, support, enabled, savedAttempts] = await Promise.all([
        getSavedEmail(),
        getBiometricSupport(),
        isBiometricEnabled(),
        getAttempts(),
      ]);

      if (!active) return;

      setEmail(savedEmail ?? '');
      setBiometric(support);
      setBiometricOn(enabled);
      setAttemptCount(savedAttempts);

      if (enabled && support.available && !promptedRef.current) {
        promptedRef.current = true;
        void runBiometric();
      }
    })();

    return () => {
      active = false;
    };
  }, [runBiometric]);

  async function handleFailure() {
    const next = attempts + 1;
    setAttemptCount(next);
    await setAttempts(next);

    setError(true);
    setPin('');

    if (next >= MAX_PIN_ATTEMPTS) {
      // Naubos ang subok — binubura ang PIN at pinapabalik sa password login.
      await clearSecurity();
      Alert.alert(
        'Too many attempts',
        'Your PIN has been removed for security. Please sign in with your email and password.',
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );
    }
  }

  async function handleChange(next: string) {
    setError(false);
    setPin(next);

    if (next.length < PIN_LENGTH) return;

    if (await verifyPin(next)) {
      await resetAttempts();
      router.replace('/dashboard');
    } else {
      await handleFailure();
    }
  }

  function usePassword() {
    Alert.alert(
      'Use password instead',
      'You will sign in with your email and password. Your PIN stays saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => router.replace('/login') },
      ]
    );
  }

  const remaining = MAX_PIN_ATTEMPTS - attempts;
  const showBiometricKey = biometricOn && !!biometric?.available;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + Spacing.xxl }]}>
      <StatusBar style="light" />

      <View style={styles.top}>
        <View style={styles.sealRing}>
          <Image
            source={require('../../assets/images/batologo-256.png')}
            style={styles.seal}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.email}>{email || 'Enter your PIN to continue'}</Text>
      </View>

      <View style={styles.middle}>
        <Text style={styles.prompt}>Enter your {PIN_LENGTH}-digit PIN</Text>

        <PinPad
          value={pin}
          onChange={handleChange}
          length={PIN_LENGTH}
          error={error}
          onDark
          biometricIcon={showBiometricKey ? biometric.icon : null}
          onBiometric={runBiometric}
        />

        <View style={styles.messageSlot}>
          {error && attempts > 0 && attempts < MAX_PIN_ATTEMPTS && (
            <Text style={styles.warning}>
              Incorrect PIN · {remaining} {remaining === 1 ? 'attempt' : 'attempts'} remaining
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {showBiometricKey && (
          <Text style={styles.hint}>Tap the {biometric.label.toLowerCase()} icon to unlock</Text>
        )}

        <Pressable hitSlop={10} onPress={usePassword} accessibilityRole="button">
          <Text style={styles.link}>Use password instead</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
  },
  top: {
    alignItems: 'center',
  },
  sealRing: {
    width: 84,
    height: 84,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  seal: {
    width: 66,
    height: 66,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.onPrimary,
    letterSpacing: -0.3,
  },
  email: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
    color: Colors.primaryLight,
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prompt: {
    marginBottom: Spacing.xl,
    fontSize: FontSize.sm,
    color: Colors.primaryLight,
  },
  // Nakalaan na espasyo para hindi tumalon ang keypad kapag lumabas ang babala.
  messageSlot: {
    height: 34,
    justifyContent: 'center',
  },
  warning: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.accent,
    textAlign: 'center',
  },
  bottom: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
  },
  link: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.onPrimary,
    textDecorationLine: 'underline',
  },
});
