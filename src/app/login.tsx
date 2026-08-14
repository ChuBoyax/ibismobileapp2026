import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { hasPin, saveEmail } from '@/lib/auth-storage';

// Pansamantalang hardcoded na credentials. Papalitan ito ng tunay na API call
// kapag nakakabit na ang backend.
const DEMO_EMAIL = 'admin@gmail.com';
const DEMO_PASSWORD = 'password123';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = {
  email?: string;
  password?: string;
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  // Hawak natin ang timer para kanselahin kapag umalis sa screen habang "nagla-login".
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function validate() {
    const next: Errors = {};

    if (!email.trim()) {
      next.email = 'Email is required.';
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      next.email = 'Please enter a valid email address.';
    }

    if (!password) {
      next.password = 'Password is required.';
    } else if (password.length < 6) {
      next.password = 'Password must be at least 6 characters.';
    }

    return next;
  }

  function handleLogin() {
    setFormError('');

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // WALA PANG BACKEND — pinipeke lang natin ang network delay para makita ang loading state.
    setLoading(true);
    timer.current = setTimeout(async () => {
      const normalized = email.trim().toLowerCase();
      const ok = normalized === DEMO_EMAIL && password === DEMO_PASSWORD;

      if (!ok) {
        setLoading(false);
        setFormError('Invalid email or password.');
        return;
      }

      await saveEmail(normalized);
      setLoading(false);

      // Kapag wala pang PIN, dumadaan muna sa security setup bago ang dashboard.
      // replace (hindi push) para hindi na makabalik sa login gamit ang back button.
      router.replace((await hasPin()) ? '/dashboard' : '/setup-security');
    }, 1200);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Green header na may curved na ilalim */}
          <View style={[styles.header, { paddingTop: insets.top + Spacing.xxl }]}>
            <View style={styles.sealRing}>
              <Image
                source={require('../../assets/images/batologo-256.png')}
                style={styles.seal}
                resizeMode="contain"
                accessibilityLabel="Seal of the Municipality of Bato, Leyte"
              />
            </View>

            <Text style={styles.appTitle}>Integrated Barangay{'\n'}Information System</Text>
            <Text style={styles.appSubtitle}>Municipality of Bato, Province of Leyte</Text>
          </View>

          {/* Puting card na nakapatong sa header */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in to your account</Text>

            {!!formError && (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>{formError}</Text>
              </View>
            )}

            <TextField
              label="Email"
              icon="mail-outline"
              placeholder="Enter your email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                if (formError) setFormError('');
              }}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <TextField
              label="Password"
              icon="lock-closed-outline"
              placeholder="Enter your password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                if (formError) setFormError('');
              }}
              error={errors.password}
              secure
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button">
              {loading ? (
                <ActivityIndicator color={Colors.onPrimary} />
              ) : (
                <Text style={styles.buttonText}>LOG IN</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scroll: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingBottom: Spacing.xxl + Spacing.xl,
    paddingHorizontal: Spacing.xl,
    borderBottomLeftRadius: Radius.header,
    borderBottomRightRadius: Radius.header,
  },
  sealRing: {
    width: 112,
    height: 112,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 4,
    borderColor: Colors.primaryLight,
  },
  seal: {
    width: 92,
    height: 92,
  },
  appTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.onPrimary,
    textAlign: 'center',
    lineHeight: 30,
  },
  appSubtitle: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.primaryLight,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  card: {
    marginTop: -Spacing.xxl,
    marginHorizontal: Spacing.xl,
    padding: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xl,
  },
  banner: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    backgroundColor: '#FDECEA',
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
  },
  bannerText: {
    fontSize: FontSize.sm,
    color: Colors.danger,
    fontWeight: '600',
  },
  button: {
    marginTop: Spacing.sm,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: Colors.primaryDark,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.onPrimary,
    letterSpacing: 1,
  },
});
