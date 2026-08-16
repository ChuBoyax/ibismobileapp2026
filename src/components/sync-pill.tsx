import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useOfflineSession } from '@/lib/use-offline-session';
import { subscribe, type SyncState } from '@/lib/sync';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Estado ng sync sa header ng dashboard.
 *
 * Tahimik ito kapag walang dapat asikasuhin — hindi humihingi ng pansin ang
 * "lahat ay naipadala na". Kapansin-pansin lang ito kapag may naghihintay, at
 * pula lang kapag may kailangang gawin ang tao. Kung laging maingay ang
 * indicator, natututo ang user na huwag itong tingnan.
 */
export function SyncPill() {
  const [state, setState] = useState<SyncState | null>(null);
  const offlineSession = useOfflineSession();

  useEffect(() => subscribe(setState), []);

  if (!state) return null;

  // Sa offline na pagpasok, ang ReauthBanner na ang nagsasalita. Kung
  // magpapakita rin ang pill dito, dalawang tanda ang sabay na hihingi ng
  // pansin para sa iisang bagay — at iyon mismo ang nakakalito.
  if (offlineSession) return null;

  const { running, counts } = state;
  const waiting = counts.pending + counts.syncing;

  // Walang naiwan at walang tumatakbo — walang dapat sabihin.
  if (counts.total === 0 && !running) return null;

  // Malawak ang uri para makapagpalit ng tono — magkakaiba ang literal na
  // hex ng bawat estilo, kaya hindi sila magkatugma kung babanggitin nang tuwid.
  let icon: IoniconName = 'cloud-upload-outline';
  let label = `${waiting} waiting to sync`;
  let tone: { backgroundColor: string } = styles.neutral;
  let textTone: { color: string } = styles.neutralText;

  if (counts.needsFix > 0) {
    icon = 'alert-circle';
    label = `${counts.needsFix} needs fixing`;
    tone = styles.danger;
    textTone = styles.dangerText;
  } else if (running) {
    icon = 'sync';
    label = waiting > 0 ? `Syncing ${waiting}…` : 'Syncing…';
    tone = styles.info;
    textTone = styles.infoText;
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.pill, tone, pressed && styles.pressed]}
      onPress={() => router.push('/sync')}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Ionicons name={icon} size={13} color={textTone.color} />
      <Text style={[styles.text, textTone]}>{label}</Text>
    </Pressable>
  );
}

/** Buong hanay para sa ilalim ng pangalan sa header. */
export function SyncPillRow() {
  return (
    <View style={styles.row}>
      <SyncPill />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
  },
  pressed: {
    opacity: 0.75,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  neutral: {
    backgroundColor: Colors.warningLight,
  },
  neutralText: {
    color: Colors.warning,
  },
  info: {
    backgroundColor: Colors.infoLight,
  },
  infoText: {
    color: Colors.info,
  },
  danger: {
    backgroundColor: Colors.dangerLight,
  },
  dangerText: {
    color: Colors.danger,
  },
});
