import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { subscribe, type SyncState } from '@/lib/sync';
import { useOfflineSession } from '@/lib/use-offline-session';

/**
 * Paanyaya na mag-login muli para makapag-sync.
 *
 * Lumilitaw kapag pumasok ang user nang walang koneksyon. Sa ganoong pagpasok,
 * walang token ang app — imposible iyong makuha nang hindi nakakausap ang
 * server — kaya nakikita niya ang naka-save na datos pero walang maipapadala.
 *
 * IISA LANG ANG MENSAHE DITO, at sinasadya iyon. Dati ay may dilaw na
 * "Offline" at pulang "Sign in to sync" nang sabay: nagsasalungat sila, at
 * hindi malaman ng user kung alin ang totoo o ano ang gagawin. Ang isang
 * mensaheng may dahilan at may pindutan ay mas malinaw kaysa dalawang tanda.
 */
export function ReauthBanner() {
  const offline = useOfflineSession();
  const [state, setState] = useState<SyncState | null>(null);

  useEffect(() => subscribe(setState), []);

  if (!offline || !state) return null;

  const waiting = state.counts.pending + state.counts.syncing + state.counts.needsFix;

  // Walang naghihintay na tala — walang mawawala kahit hindi muna mag-login.
  // Ang paalalang walang aksyong kailangan ay ingay lang; kapag laging may
  // pulang bagay sa screen, natututo ang user na huwag itong pansinin.
  if (waiting === 0) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Ionicons name="key" size={16} color={Colors.danger} />
        </View>
        <Text style={styles.title}>Sign in to sync</Text>
      </View>

      <Text style={styles.body}>
        You signed in without a connection, so {waiting} saved{' '}
        {waiting === 1 ? 'record has' : 'records have'} not been sent yet. Sign in again to send{' '}
        {waiting === 1 ? 'it' : 'them'}.
      </Text>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        onPress={() => router.push('/login')}
        accessibilityRole="button">
        <Text style={styles.buttonText}>Sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerLight,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.danger,
  },
  body: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.danger,
    lineHeight: 19,
  },
  button: {
    marginTop: Spacing.md,
    height: 42,
    borderRadius: Radius.sm,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
});
