import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { goBack } from '@/lib/navigation';

type FormGateProps = {
  title: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: React.ReactNode;
};

/**
 * Hinaharang ang form hanggang dumating ang laman ng mga dropdown.
 *
 * Sinasadyang hindi ipinapakita ang form habang naghihintay: ang isang form na
 * puro walang lamang dropdown ay mukhang sira, at mas malamang na may maisulat
 * na maling datos kaysa maghintay ng ilang segundo.
 */
export function FormGate({ title, loading, error, onRetry, children }: FormGateProps) {
  const insets = useSafeAreaInsets();

  if (!loading && !error) return <>{children}</>;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          style={styles.headerButton}
          onPress={() => goBack()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={20} color={Colors.onPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      <View style={styles.body}>
        {loading ? (
          <>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.message}>Loading the form…</Text>
          </>
        ) : (
          <>
            <View style={styles.iconRing}>
              <Ionicons name="cloud-offline-outline" size={34} color={Colors.danger} />
            </View>
            <Text style={styles.errorTitle}>Cannot load the form</Text>
            <Text style={styles.message}>{error}</Text>

            <Pressable style={styles.retry} onPress={onRetry} accessibilityRole="button">
              <Ionicons name="refresh" size={18} color={Colors.onPrimary} />
              <Text style={styles.retryLabel}>Try again</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Colors.onPrimaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.onPrimary,
    letterSpacing: -0.3,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  errorTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  message: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 48,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  retryLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
});
