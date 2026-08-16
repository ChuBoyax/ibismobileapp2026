import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { TAB_BAR_HEIGHT } from '@/components/animated-tab-bar';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { logout as apiLogout } from '@/lib/api';
import {
  clearSecurity,
  hasPin,
  isBiometricEnabled,
  setBiometricEnabled,
} from '@/lib/auth-storage';
import { authenticate, getBiometricSupport, type BiometricSupport } from '@/lib/biometrics';
import { clearCache } from '@/lib/db';
import { endSession } from '@/lib/session';
import { initialOf, useProfile } from '@/lib/use-profile';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type Option = {
  label: string;
  hint: string;
  icon: IoniconName;
  tint: string;
  color: string;
  onPress?: () => void;
};

const ACCOUNT: Option[] = [
  {
    label: 'Account Information',
    hint: 'Name, email, and password',
    icon: 'person-circle-outline',
    tint: Colors.primaryLight,
    color: Colors.primary,
    onPress: () => router.push('/account'),
  },
  {
    label: 'Notifications',
    hint: 'Alerts and announcements',
    icon: 'notifications-outline',
    tint: Colors.warningLight,
    color: Colors.warning,
    onPress: () => router.push('/notifications'),
  },
  {
    label: 'About IBIS',
    hint: 'Version and system details',
    icon: 'information-circle-outline',
    tint: Colors.infoLight,
    color: Colors.info,
  },
];

function Row({
  icon,
  tint,
  color,
  label,
  hint,
  right,
  onPress,
  last,
}: {
  icon: IoniconName;
  tint: string;
  color: string;
  label: string;
  hint: string;
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const content = (
    <>
      <View style={[styles.rowIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>

      <View style={styles.flex}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>

      {right ?? <Ionicons name="chevron-forward" size={16} color={Colors.border} />}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, last && styles.lastRow]}>{content}</View>;
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.row, last && styles.lastRow, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button">
      {content}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const profile = useProfile();
  const [biometric, setBiometric] = useState<BiometricSupport | null>(null);
  const [biometricOn, setBiometricOn] = useState(false);
  const [pinSet, setPinSet] = useState(false);

  // Nire-refresh tuwing babalik sa tab para tama ang estado pagkatapos mag-set ng PIN.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        const [support, enabled, hasOne] = await Promise.all([
          getBiometricSupport(),
          isBiometricEnabled(),
          hasPin(),
        ]);

        if (!active) return;
        setBiometric(support);
        setBiometricOn(enabled);
        setPinSet(hasOne);
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  async function toggleBiometric(next: boolean) {
    if (!next) {
      setBiometricOn(false);
      await setBiometricEnabled(false);
      return;
    }

    if (!pinSet) {
      Alert.alert('Set a PIN first', 'A PIN is required as a backup before enabling biometrics.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Set PIN', onPress: () => router.push('/setup-security') },
      ]);
      return;
    }

    const ok = await authenticate(`Enable ${biometric?.label ?? 'biometrics'} for IBIS`);
    if (ok) {
      setBiometricOn(true);
      await setBiometricEnabled(true);
    } else {
      Alert.alert('Not enabled', 'We could not verify your biometrics.');
    }
  }

  function handleLogout() {
    Alert.alert('Log out', 'Your PIN and biometric settings stay saved on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        // Hindi binubura ang PIN — session lang ang tinatapos.
        // replace para hindi na makabalik sa dashboard gamit ang back button.
        onPress: async () => {
          await apiLogout(); // binabawi ang token sa server
          await endSession();
          router.replace('/login');
        },
      },
    ]);
  }

  function handleRemoveSecurity() {
    Alert.alert(
      'Remove PIN and biometrics?',
      'You will need to set them up again the next time you sign in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await apiLogout();
            await Promise.all([clearSecurity(), clearCache()]);
            setPinSet(false);
            setBiometricOn(false);
            router.replace('/login');
          },
        },
      ]
    );
  }

  const biometricAvailable = !!biometric?.available;
  const biometricLabel = biometric?.label ?? 'Biometrics';

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScreenHeader title="Settings" subtitle="Account and app preferences" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialOf(profile?.name)}</Text>
          </View>

          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>
              {profile?.name ?? '—'}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {profile?.email ?? 'Not signed in'}
            </Text>
          </View>

          {!!profile?.role && (
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>{profile.role}</Text>
            </View>
          )}
        </View>

        <Text style={styles.groupLabel}>SECURITY</Text>
        <View style={styles.list}>
          <Row
            icon={biometric?.icon ?? 'finger-print'}
            tint={Colors.primaryLight}
            color={Colors.primary}
            label={`${biometricLabel} sign-in`}
            hint={
              biometricAvailable
                ? 'Unlock without typing your PIN'
                : 'Not available or not enrolled on this device'
            }
            right={
              <Switch
                value={biometricOn && biometricAvailable}
                onValueChange={toggleBiometric}
                disabled={!biometricAvailable}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.surface}
              />
            }
          />

          <Row
            icon="keypad-outline"
            tint={Colors.infoLight}
            color={Colors.info}
            label={pinSet ? 'Change PIN' : 'Set up PIN'}
            hint={pinSet ? 'A 6-digit PIN is currently set' : 'No PIN set yet'}
            onPress={() => router.push('/setup-security')}
          />

          <Row
            icon="trash-outline"
            tint={Colors.dangerLight}
            color={Colors.danger}
            label="Remove PIN and biometrics"
            hint="Clears the saved security on this device"
            onPress={handleRemoveSecurity}
            last
          />
        </View>

        <Text style={styles.groupLabel}>ACCOUNT</Text>
        <View style={styles.list}>
          {ACCOUNT.map((item, index) => (
            <Row key={item.label} {...item} last={index === ACCOUNT.length - 1} />
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [styles.logout, pressed && styles.logoutPressed]}
          onPress={handleLogout}
          accessibilityRole="button">
          <Ionicons name="log-out-outline" size={19} color={Colors.danger} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>

        <Text style={styles.version}>IBIS Mobile · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    // Puwang para sa lumulutang na tab bar.
    paddingBottom: Spacing.xxl + TAB_BAR_HEIGHT,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.onPrimary,
  },
  name: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  email: {
    marginTop: 2,
    fontSize: FontSize.sm,
    color: Colors.muted,
  },
  rolePill: {
    paddingVertical: 5,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  groupLabel: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
    letterSpacing: 1,
  },
  list: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    ...Shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowPressed: {
    opacity: 0.6,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  rowHint: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.dangerLight,
  },
  logoutPressed: {
    backgroundColor: Colors.dangerLight,
  },
  logoutText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.danger,
  },
  version: {
    marginTop: Spacing.xl,
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
});
