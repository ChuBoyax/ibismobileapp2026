import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextField } from '@/components/text-field';
import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import {
  account as fetchAccount,
  ApiError,
  updateAccount,
  updatePassword,
  type Account,
} from '@/lib/api';
import { saveEmail, saveProfile } from '@/lib/auth-storage';
import { handleAuthError } from '@/lib/session';

type Mode = 'view' | 'edit' | 'password';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<Account | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Edit ng profile
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Palit ng password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const result = await fetchAccount();
      if (!mounted.current) return;

      setData(result.account);
      setName(result.account.name);
      setEmail(result.account.email);
      setError('');
    } catch (err) {
      if (await handleAuthError(err)) return;
      if (!mounted.current) return;

      setError(err instanceof ApiError ? err.message : 'Could not load your account.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      load();

      return () => {
        mounted.current = false;
      };
    }, [load])
  );

  function startEdit() {
    setError('');
    setName(data?.name ?? '');
    setEmail(data?.email ?? '');
    setMode('edit');
  }

  function startPassword() {
    setError('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setMode('password');
  }

  function cancel() {
    setError('');
    setMode('view');
  }

  async function handleSaveProfile() {
    setError('');
    setSaving(true);

    try {
      const result = await updateAccount(name.trim(), email.trim().toLowerCase());
      if (!mounted.current) return;

      setData(result.account);

      // Pinapanatiling tugma ang naka-cache na profile para tama pa rin ang
      // ipinapakita ng dashboard at settings nang hindi na kailangang mag-login.
      await Promise.all([saveProfile(result.account), saveEmail(result.account.email)]);

      setMode('view');
      Alert.alert('Saved', 'Your account information has been updated.');
    } catch (err) {
      if (await handleAuthError(err)) return;
      if (!mounted.current) return;

      setError(err instanceof ApiError ? err.message : 'Could not save your changes.');
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  async function handleSavePassword() {
    setError('');

    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }

    setSaving(true);

    try {
      await updatePassword(currentPassword, newPassword, confirmPassword);
      if (!mounted.current) return;

      setMode('view');
      Alert.alert(
        'Password changed',
        'Your password has been updated. Other devices have been signed out.'
      );
    } catch (err) {
      if (await handleAuthError(err)) return;
      if (!mounted.current) return;

      setError(err instanceof ApiError ? err.message : 'Could not change your password.');
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  const barangays = data?.barangays.map((b) => b.name).join(' · ') || 'No barangay assigned';

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            onPress={() => (mode === 'view' ? router.back() : cancel())}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={22} color={Colors.onPrimary} />
          </Pressable>

          <View style={styles.flex}>
            <Text style={styles.title}>Account Information</Text>
            <Text style={styles.subtitle}>
              {mode === 'password' ? 'Change your password' : 'Your profile and sign-in details'}
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {!!error && (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{error}</Text>
            </View>
          )}

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : mode === 'view' ? (
            <>
              <View style={styles.profileCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {data?.name?.trim()?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
                <Text style={styles.name}>{data?.name ?? '—'}</Text>
                {!!data?.role && (
                  <View style={styles.rolePill}>
                    <Text style={styles.rolePillText}>{data.role}</Text>
                  </View>
                )}
              </View>

              <View style={styles.list}>
                <Field label="Email" value={data?.email ?? '—'} />
                <Field label="Barangay" value={barangays} />
                <Field label="Member since" value={data?.member_since ?? '—'} last />
              </View>

              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                onPress={startEdit}
                accessibilityRole="button">
                <Ionicons name="create-outline" size={19} color={Colors.onPrimary} />
                <Text style={styles.buttonText}>Edit information</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                onPress={startPassword}
                accessibilityRole="button">
                <Ionicons name="key-outline" size={19} color={Colors.primary} />
                <Text style={styles.secondaryText}>Change password</Text>
              </Pressable>
            </>
          ) : mode === 'edit' ? (
            <View style={styles.formCard}>
              <TextField
                label="Full name"
                icon="person-outline"
                placeholder="Enter your name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />

              <TextField
                label="Email"
                icon="mail-outline"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Actions saving={saving} onCancel={cancel} onSave={handleSaveProfile} label="Save changes" />
            </View>
          ) : (
            <View style={styles.formCard}>
              <TextField
                label="Current password"
                icon="lock-closed-outline"
                placeholder="Enter your current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secure
                autoCapitalize="none"
              />

              <TextField
                label="New password"
                icon="key-outline"
                placeholder="At least 8 characters"
                value={newPassword}
                onChangeText={setNewPassword}
                secure
                autoCapitalize="none"
              />

              <TextField
                label="Confirm new password"
                icon="key-outline"
                placeholder="Repeat the new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secure
                autoCapitalize="none"
              />

              <Actions
                saving={saving}
                onCancel={cancel}
                onSave={handleSavePassword}
                label="Update password"
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && styles.lastRow]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function Actions({
  saving,
  onCancel,
  onSave,
  label,
}: {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  label: string;
}) {
  return (
    <View style={styles.actions}>
      <Pressable
        style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
        onPress={onCancel}
        disabled={saving}
        accessibilityRole="button">
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.save, pressed && styles.pressed, saving && styles.disabled]}
        onPress={onSave}
        disabled={saving}
        accessibilityRole="button">
        {saving ? (
          <ActivityIndicator color={Colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>{label}</Text>
        )}
      </Pressable>
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
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.onPrimaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.7,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.onPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 2,
    fontSize: FontSize.sm,
    color: Colors.primaryLight,
  },
  content: {
    padding: Spacing.xl,
  },
  loading: {
    paddingVertical: Spacing.xxl,
  },
  banner: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    backgroundColor: Colors.dangerLight,
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
  },
  bannerText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.danger,
  },
  profileCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.onPrimary,
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  rolePill: {
    marginTop: Spacing.sm,
    paddingVertical: 5,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  list: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    ...Shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    width: 110,
    fontSize: FontSize.sm,
    color: Colors.muted,
  },
  rowValue: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
  },
  formCard: {
    padding: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  buttonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
  },
  secondaryText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  cancel: {
    flex: 1,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  save: {
    flex: 2,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
