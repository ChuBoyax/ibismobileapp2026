import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_HEIGHT } from '@/components/animated-tab-bar';
import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { ActivitySheet } from '@/components/activity-sheet';
import { ReauthBanner } from '@/components/reauth-banner';
import { SyncPillRow } from '@/components/sync-pill';
import {
  ApiError,
  dashboard,
  notifications,
  type ActivityItem,
  type DashboardData,
  type Stat,
} from '@/lib/api';
import { formatNumber, relativeTime } from '@/lib/format';
import { CacheKey, getCache, putCache } from '@/lib/db';
import { handleAuthError } from '@/lib/session';
import { useOfflineSession } from '@/lib/use-offline-session';
import { useProfile } from '@/lib/use-profile';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Hitsura ng bawat stat card. Ang bilang ay galing sa server. */
const STAT_META: {
  key: keyof DashboardData['stats'];
  label: string;
  icon: IoniconName;
  tint: string;
  color: string;
}[] = [
  {
    key: 'residents',
    label: 'Total Residents',
    icon: 'people',
    tint: Colors.primaryLight,
    color: Colors.primary,
  },
  {
    key: 'families',
    label: 'Families',
    icon: 'person-add',
    tint: Colors.infoLight,
    color: Colors.info,
  },
  {
    key: 'households',
    label: 'Households',
    icon: 'home',
    tint: Colors.warningLight,
    color: Colors.warning,
  },
  {
    key: 'pending_documents',
    label: 'Pending Documents',
    icon: 'document-text',
    tint: Colors.dangerLight,
    color: Colors.danger,
  },
];

/*
  Ang tatlong pinakamadalas na simulan mula sa dashboard.

  Ang dating "Generate Report" ay inalis: may sariling tab na ang ulat, at
  walang ginagawa ang pindutan kundi ulitin ang nandoon na. Ang pamilya naman
  ay isa sa tatlong bagay na itinatala sa field, kaya nararapat itong nasa
  parehong hanay ng residente at sambahayan.
*/
const QUICK_ACTIONS: { label: string; icon: IoniconName; href: Href }[] = [
  { label: 'Add Resident', icon: 'person-add-outline', href: '/registration/resident' },
  { label: 'Add Family', icon: 'people-outline', href: '/registration/family' },
  { label: 'New Household', icon: 'home-outline', href: '/registration/household' },
];

const ACTIVITY_STYLE: Record<ActivityItem['type'], { icon: IoniconName; tint: string; color: string }> =
  {
    resident: { icon: 'person-add', tint: Colors.primaryLight, color: Colors.primary },
    household: { icon: 'home', tint: Colors.warningLight, color: Colors.warning },
    document: { icon: 'document-text', tint: Colors.infoLight, color: Colors.info },
  };

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!action && <Text style={styles.sectionAction}>{action}</Text>}
    </View>
  );
}

function StatCard({ meta, stat }: { meta: (typeof STAT_META)[number]; stat?: Stat }) {
  const isNew = (stat?.new_this_month ?? 0) > 0;

  return (
    <View style={styles.statCard}>
      <View style={styles.statTop}>
        <View style={[styles.statIcon, { backgroundColor: meta.tint }]}>
          <Ionicons name={meta.icon} size={18} color={meta.color} />
        </View>

        {isNew ? (
          <View style={styles.trendRow}>
            <Ionicons name="trending-up" size={12} color={Colors.primary} />
            <Text style={[styles.trendText, { color: Colors.primary }]}>
              +{stat?.new_this_month}
            </Text>
          </View>
        ) : (
          <Text style={[styles.trendText, { color: Colors.muted }]}>—</Text>
        )}
      </View>

      <Text style={styles.statValue}>{stat ? formatNumber(stat.total) : '–'}</Text>
      <Text style={styles.statLabel}>{meta.label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const reauthNeeded = useOfflineSession();

  const [data, setData] = useState<DashboardData | null>(null);
  const [selected, setSelected] = useState<ActivityItem | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const mounted = useRef(true);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    // Ipinapakita agad ang huling naka-save bago pa man subukan ang server.
    //
    // Kung hihintayin muna ang network, ang user na walang signal ay
    // titingin ng spinner nang labinlimang segundo bago pa lumitaw ang datos
    // na nasa cellphone na pala niya sa buong oras na iyon. Sa halip: laman
    // muna, saka pagsasariwa — kaya agad ang bukas kahit nasa bundok ka.
    if (!isRefresh) {
      const saved = await getCache<DashboardData>(CacheKey.dashboard);

      if (saved && mounted.current) {
        setData(saved.value);
        setLoading(false);
      }
    }

    try {
      const result = await dashboard();
      if (!mounted.current) return;

      setData(result);
      setError('');

      // Itinatabi para may maipakita kahit mawalan ng internet mamaya.
      putCache(CacheKey.dashboard, result);

      // Hiwalay at hindi mahalaga — kung mabigo, wala lang tuldok sa bell.
      notifications()
        .then((n) => {
          if (mounted.current) setUnread(n.unread);
        })
        .catch(() => {});
    } catch (err) {
      // Kung tinanggihan ang token, ibinabalik nito ang user sa login —
      // walang saysay ang magpakita ng blangkong dashboard.
      if (await handleAuthError(err)) return;

      // Hindi naabot ang server. Imbes na blangkong screen, ipakita ang
      // huling nakuha at sabihin nang malinaw kung kailan iyon.
      const cached = await getCache<DashboardData>(CacheKey.dashboard);

      if (!mounted.current) return;

      if (cached) {
        setData(cached.value);
        setError('');
      } else {
        setError(
          err instanceof ApiError ? err.message : 'Could not load the dashboard. Please try again.'
        );
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
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

  // Barangay galing sa dashboard response; profile ang panandaliang kapalit
  // habang naghihintay ng unang request.
  const barangays = data?.barangays.length
    ? data.barangays.join(' · ')
    : (profile?.barangays.map((b) => b.name.trim()).join(' · ') ?? '');

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <View style={styles.headerRow}>
            <View style={styles.seal}>
              <Image
                source={require('../../../assets/images/batologo-256.png')}
                style={styles.sealImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.flex}>
              <Text style={styles.greeting}>Good day,</Text>
              <Text style={styles.name} numberOfLines={1}>
                {profile?.name ?? '—'}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.bell, pressed && styles.bellPressed]}
              onPress={() => router.push('/notifications')}
              accessibilityRole="button"
              accessibilityLabel="Notifications">
              <Ionicons name="notifications-outline" size={20} color={Colors.onPrimary} />
              {unread > 0 && <View style={styles.bellDot} />}
            </Pressable>
          </View>

          <View style={styles.headerMeta}>
            <Ionicons name="location-outline" size={13} color={Colors.primaryLight} />
            <Text style={styles.headerMetaText} numberOfLines={1}>
              {barangays || 'No barangay assigned'}
            </Text>
          </View>

          {/* Lumilitaw lang kapag may naghihintay o may kailangang ayusin. */}
          <SyncPillRow />
        </View>

        <View style={styles.content}>
          {!!error && (
            <Pressable style={styles.banner} onPress={() => load()}>
              <Ionicons name="cloud-offline-outline" size={18} color={Colors.danger} />
              <View style={styles.flex}>
                <Text style={styles.bannerText}>{error}</Text>
                <Text style={styles.bannerHint}>Tap to retry</Text>
              </View>
            </Pressable>
          )}

          {/* Lumilitaw lang kapag may talagang naghihintay na tala. */}
          <ReauthBanner />

          {loading && !data ? (
            <View style={styles.loading}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.loadingText}>Loading barangay data…</Text>
            </View>
          ) : (
            <View style={styles.statGrid}>
              {STAT_META.map((meta) => (
                <StatCard key={meta.key} meta={meta} stat={data?.stats[meta.key]} />
              ))}
            </View>
          )}

          <SectionTitle title="Quick Actions" />
          <View style={styles.actionRow}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.label}
                style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
                onPress={() => router.push(action.href)}
                accessibilityRole="button"
                accessibilityLabel={action.label}>
                <View style={styles.actionIcon}>
                  <Ionicons name={action.icon} size={20} color={Colors.primary} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>

          <SectionTitle title="Recent Activity" />
          <View style={styles.activityCard}>
            {!data?.activity.length ? (
              <View style={styles.empty}>
                <Ionicons name="time-outline" size={22} color={Colors.muted} />
                <Text style={styles.emptyText}>
                  {loading ? 'Loading…' : 'No recent activity in your barangay yet.'}
                </Text>
              </View>
            ) : (
              data.activity.map((item, index) => {
                const style = ACTIVITY_STYLE[item.type] ?? ACTIVITY_STYLE.resident;

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelected(item)}
                    style={({ pressed }) => [
                      styles.activityRow,
                      index === data.activity.length - 1 && styles.lastRow,
                      pressed && styles.activityRowPressed,
                    ]}
                    accessibilityRole="button">
                    <View style={[styles.activityIcon, { backgroundColor: style.tint }]}>
                      <Ionicons name={style.icon} size={16} color={style.color} />
                    </View>

                    <View style={styles.flex}>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.activityTime} numberOfLines={1}>
                        {item.subtitle} · {relativeTime(item.at)}
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={16} color={Colors.border} />
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      <ActivitySheet item={selected} onClose={() => setSelected(null)} />
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
    // Lumulutang ang tab bar sa ibabaw ng nilalaman, kaya kailangan ng
    // sariling puwang para maabot pa rin ang dulo ng pahina.
    paddingBottom: Spacing.xxl + TAB_BAR_HEIGHT,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl + Spacing.xl,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  seal: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealImage: {
    width: 34,
    height: 34,
  },
  greeting: {
    fontSize: FontSize.sm,
    color: Colors.primaryLight,
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.onPrimary,
    letterSpacing: -0.3,
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.onPrimaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellPressed: {
    opacity: 0.7,
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
  },
  headerMetaText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
    letterSpacing: 0.2,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    marginTop: -Spacing.xxl,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.md,
  },
  bannerText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.danger,
  },
  bannerHint: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.danger,
  },
  loading: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.muted,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statCard: {
    flexBasis: '46%',
    flexGrow: 1,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statValue: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.6,
  },
  statLabel: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  sectionAction: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  actionCardPressed: {
    backgroundColor: Colors.primaryLight,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  activityCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    ...Shadow.card,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  activityRowPressed: {
    backgroundColor: Colors.primaryLight,
  },
  activityTime: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    textAlign: 'center',
  },
});
