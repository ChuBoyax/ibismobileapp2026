import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { relativeTime } from '@/lib/format';
import { goBack } from '@/lib/navigation';
import { CacheKey, getCache } from '@/lib/db';
import { counts, type OutboxCounts } from '@/lib/outbox';
import { serverUrl } from '@/lib/server-url';
import { useProfile } from '@/lib/use-profile';

type SavedList = { items: unknown[]; total: number };

type Snapshot = {
  residents: number;
  families: number;
  households: number;
  /** Kailan huling nakakuha ng bagong datos mula sa server. */
  refreshedAt: Date | null;
  queue: OutboxCounts;
};

const EMPTY: Snapshot = {
  residents: 0,
  families: 0,
  households: 0,
  refreshedAt: null,
  queue: { pending: 0, syncing: 0, needsFix: 0, conflicts: 0, total: 0 },
};

/**
 * Kung ano ang aktwal na hawak ng cellphone na ito.
 *
 * HINDI ITO PALAMUTI. Kapag may nagtanong kung bakit hindi lumalabas ang isang
 * residente, o bakit mukhang luma ang bilang, dito matatagpuan ang sagot:
 * ilan ang naka-tabi, kailan huling nakakuha, at ilan ang hindi pa naipapadala.
 * Ito rin ang unang hihingin ng sinumang tutulong nang malayuan.
 */
async function readSnapshot(): Promise<Snapshot> {
  const [residents, families, households, queue] = await Promise.all([
    getCache<SavedList>(CacheKey.listResidents),
    getCache<SavedList>(CacheKey.listFamilies),
    getCache<SavedList>(CacheKey.listHouseholds),
    counts(),
  ]);

  // Ang pinakabago sa tatlo ang tinuturing na huling pagsasariwa — magkakasabay
  // naman silang kinukuha.
  const stamps = [residents?.updatedAt, families?.updatedAt, households?.updatedAt].filter(
    (value): value is Date => value instanceof Date
  );

  return {
    residents: residents?.value.items.length ?? 0,
    families: families?.value.items.length ?? 0,
    households: households?.value.items.length ?? 0,
    refreshedAt: stamps.length
      ? new Date(Math.max(...stamps.map((date) => date.getTime())))
      : null,
    queue,
  };
}

function Line({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.line, last && styles.lastLine]}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const profile = useProfile();

  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      readSnapshot()
        .then((next) => {
          if (alive) setSnapshot(next);
        })
        .catch(() => {
          // Walang anuman — mananatili ang mga zero, at iyon na rin ang sagot.
        });

      return () => {
        alive = false;
      };
    }, [])
  );

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build = Constants.expoConfig?.android?.versionCode;
  const saved = snapshot.residents + snapshot.families + snapshot.households;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            onPress={() => goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={22} color={Colors.onPrimary} />
          </Pressable>

          <View style={styles.flex}>
            <Text style={styles.title}>About IBIS</Text>
            <Text style={styles.subtitle}>Version and system details</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}>
        {/* ── Pagkakakilanlan ──────────────────────────────────────── */}
        <View style={styles.hero}>
          <Image
            source={require('../../assets/images/batologo-256.png')}
            style={styles.seal}
            resizeMode="contain"
          />
          <Text style={styles.appName}>Integrated Barangay Information System</Text>
          <Text style={styles.place}>Municipality of Bato, Leyte</Text>
          <View style={styles.versionPill}>
            <Text style={styles.versionText}>
              Version {version}
              {build ? ` (build ${build})` : ''}
            </Text>
          </View>
        </View>

        {/* ── Ano ang hawak ng cellphone ────────────────────────────── */}
        <Text style={styles.groupLabel}>SAVED ON THIS DEVICE</Text>
        <View style={styles.card}>
          <Line label="Residents" value={String(snapshot.residents)} />
          <Line label="Families" value={String(snapshot.families)} />
          <Line label="Households" value={String(snapshot.households)} />
          <Line
            label="Last refreshed"
            value={
              snapshot.refreshedAt ? relativeTime(snapshot.refreshedAt.toISOString()) : 'Never'
            }
            last
          />
        </View>

        <Text style={styles.note}>
          {saved > 0
            ? 'These records open and can be edited without a signal. They refresh whenever you open a list while connected.'
            : 'Nothing is saved yet. Open the Residents, Families and Households tabs while connected so they work offline.'}
        </Text>

        {/* ── Ang pila ─────────────────────────────────────────────── */}
        <Text style={styles.groupLabel}>WAITING TO SEND</Text>
        <View style={styles.card}>
          <Line label="Not yet sent" value={String(snapshot.queue.pending)} />
          <Line label="Needs fixing" value={String(snapshot.queue.needsFix)} />
          <Line label="Needs your decision" value={String(snapshot.queue.conflicts)} last />
        </View>

        {/* ── Koneksyon at aparato ─────────────────────────────────── */}
        <Text style={styles.groupLabel}>SYSTEM</Text>
        <View style={styles.card}>
          <Line label="Server" value={serverUrl().replace(/^https?:\/\//, '')} />
          <Line label="Signed in as" value={profile?.email ?? 'Not signed in'} />
          <Line
            label="Barangay"
            value={profile?.barangays?.map((barangay) => barangay.name).join(', ') || '—'}
          />
          <Line label="Device" value={`${Platform.OS} ${Platform.Version}`} last />
        </View>

        <Text style={styles.footer}>
          Built for the barangay officials and enumerators of Bato, Leyte.
        </Text>
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
  pressed: {
    opacity: 0.75,
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
  title: {
    fontSize: FontSize.xl,
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
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  seal: {
    width: 88,
    height: 88,
    marginBottom: Spacing.lg,
  },
  appName: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  place: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
    color: Colors.muted,
  },
  versionPill: {
    marginTop: Spacing.lg,
    paddingVertical: 6,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
  },
  versionText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
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
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    ...Shadow.card,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  lastLine: {
    borderBottomWidth: 0,
  },
  lineLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  lineValue: {
    flexShrink: 1,
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
  },
  note: {
    marginTop: Spacing.md,
    marginHorizontal: Spacing.xs,
    fontSize: FontSize.xs,
    color: Colors.muted,
    lineHeight: 18,
  },
  footer: {
    marginTop: Spacing.xxl,
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
});
