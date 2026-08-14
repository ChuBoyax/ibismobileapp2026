import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PinPad } from '@/components/pin-pad';
import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { PIN_LENGTH, savePin, setBiometricEnabled } from '@/lib/auth-storage';
import { authenticate, getBiometricSupport, type BiometricSupport } from '@/lib/biometrics';

type Step = 'create' | 'confirm' | 'biometric';

export default function SetupSecurityScreen() {
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('create');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [biometric, setBiometric] = useState<BiometricSupport | null>(null);

  useEffect(() => {
    let active = true;
    getBiometricSupport().then((support) => {
      if (active) setBiometric(support);
    });
    return () => {
      active = false;
    };
  }, []);

  function finish() {
    router.replace('/dashboard');
  }

  async function handleChange(next: string) {
    setError(false);
    setMessage('');
    setPin(next);

    if (next.length < PIN_LENGTH) return;

    if (step === 'create') {
      setFirstPin(next);
      setPin('');
      setStep('confirm');
      return;
    }

    if (next === firstPin) {
      try {
        await savePin(next);
      } catch {
        // Kung hindi tumanggap ang secure storage, ipakita agad — huwag hayaang
        // mukhang na-save ang PIN gayong hindi naman.
        setError(true);
        setPin('');
        setMessage('Could not save your PIN on this device. Please try again.');
        return;
      }

      setPin('');

      if (biometric?.available) {
        setStep('biometric');
      } else {
        finish();
      }
    } else {
      // Hindi tugma — balik sa simula para hindi malito kung alin ang mali.
      setError(true);
      setPin('');
      setFirstPin('');
      setStep('create');
      setMessage('PINs did not match. Please start again.');
    }
  }

  async function enableBiometric() {
    const ok = await authenticate(`Enable ${biometric?.label ?? 'biometrics'} for IBIS`);

    if (ok) {
      await setBiometricEnabled(true);
      finish();
    } else {
      Alert.alert(
        'Not enabled',
        'We could not verify your biometrics. You can turn this on later in Settings.'
      );
    }
  }

  function skip() {
    Alert.alert('Skip security setup?', 'You can set a PIN later in Settings.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Skip', onPress: finish },
    ]);
  }

  const isBiometricStep = step === 'biometric';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + Spacing.lg }]}>
      <StatusBar style="dark" />

      <View style={styles.topBar}>
        <Text style={styles.stepLabel}>
          {isBiometricStep ? 'Step 2 of 2' : 'Step 1 of 2'}
        </Text>
        <Pressable hitSlop={10} onPress={skip} accessibilityRole="button">
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      {isBiometricStep ? (
        <View style={styles.body}>
          <View style={styles.badge}>
            <Ionicons name={biometric?.icon ?? 'finger-print'} size={46} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Enable {biometric?.label} sign-in?</Text>
          <Text style={styles.subtitle}>
            Unlock IBIS with your {biometric?.label.toLowerCase()} instead of typing your PIN every
            time. Your PIN still works as a backup.
          </Text>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}
              onPress={enableBiometric}
              accessibilityRole="button">
              <Ionicons
                name={biometric?.icon ?? 'finger-print'}
                size={20}
                color={Colors.onPrimary}
              />
              <Text style={styles.primaryText}>Enable {biometric?.label}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryPressed]}
              onPress={finish}
              accessibilityRole="button">
              <Text style={styles.secondaryText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.badge}>
            <Ionicons name="lock-closed" size={40} color={Colors.primary} />
          </View>

          <Text style={styles.title}>
            {step === 'create' ? 'Create your PIN' : 'Confirm your PIN'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'create'
              ? `Choose a ${PIN_LENGTH}-digit PIN to unlock IBIS quickly and securely.`
              : 'Enter the same PIN again to confirm.'}
          </Text>

          <View style={styles.padWrap}>
            <PinPad value={pin} onChange={handleChange} length={PIN_LENGTH} error={error} />
          </View>

          <View style={styles.messageSlot}>
            {!!message && <Text style={styles.error}>{message}</Text>}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.muted,
    letterSpacing: 0.8,
  },
  skip: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.sm,
  },
  padWrap: {
    marginTop: Spacing.xxl,
  },
  messageSlot: {
    height: 34,
    justifyContent: 'center',
  },
  error: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.danger,
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    marginTop: Spacing.xxl,
    gap: Spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    ...Shadow.card,
  },
  primaryPressed: {
    backgroundColor: Colors.primaryDark,
  },
  primaryText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
  secondaryButton: {
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryPressed: {
    backgroundColor: Colors.primaryLight,
  },
  secondaryText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.muted,
  },
});
