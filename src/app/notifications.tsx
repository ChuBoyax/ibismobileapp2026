import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RequireAuth } from '@/components/require-auth';
import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { ApiError, notifications, type Notification } from '@/lib/api';
import { CacheKey, getCache, putCache } from '@/lib/db';
import { relativeTime } from '@/lib/format';
import { goBack } from '@/lib/navigation';
import { handleAuthError } from '@/lib/session';

/**
 * Ang bawat abiso ay hinahalaw sa tunay na datos, kaya hindi ito basta
 * mabubura sa server. Ang "Clear" ay nagtatala kung kailan ito itinago —
 * babalik lang ito kapag may mas bagong galaw kaysa sa oras na iyon.
 */
type Dismissed = Record<string, string>;

function isVisible(item: Notification, dismissed: Dismissed) {
  const at = dismissed[item.id];

  if (!at) return true;
  if (!item.at) return false;

  return item.at > at;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const LEVEL: Record<Notification['level'], { icon: IoniconName; tint: string; color: string }> = {
  info: { icon: 'people', tint: Colors.primaryLight, color: Colors.primary },
  warning: { icon: 'document-text', tint: Colors.warningLight, color: Colors.warning },
  success: { icon: 'checkmark-circle', tint: Colors.infoLight, color: Colors.info },
};

/** Kailangan ng token — walang laman ang screen na ito kung hindi naka-login. */
export default function GuardedNotificationsScreen() {
  return (
    <RequireAuth>
      <NotificationsScreen />
    </RequireAuth>
  );
}

function NotificationsScreen() {
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<Notification[]>([]);
  const [dismissed, setDismissed] = useState<Dismissed>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const mounted = useRef(true);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    // Ang listahan ng itinago ay nananatili kahit i-restart ang app.
    const saved = await getCache<Dismissed>(CacheKey.dismissedNotifications);
    if (mounted.current && saved) setDismissed(saved.value);

    // Laman muna, saka pagsasariwa — para agad may makita kahit walang signal.
    if (!isRefresh) {
      const stored = await getCache<Notification[]>(CacheKey.notifications);

      if (stored && mounted.current) {
        setItems(stored.value);
        setLoading(false);
      }
    }

    try {
      const result = await notifications();
      if (!mounted.current) return;

      setItems(result.notifications);
      setError('');

      putCache(CacheKey.notifications, result.notifications);
    } catch (err) {
      if (await handleAuthError(err)) return;

      // Walang internet — ipakita ang huling nakuha.
      const cached = await getCache<Notification[]>(CacheKey.notifications);

      if (!mounted.current) return;

      if (cached) {
        setItems(cached.value);
        setError('');
      } else {
        setError(
          err instanceof ApiError ? err.message : 'Could not load notifications. Please try again.'
        );
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  async function clearAll() {
    const now = new Date().toISOString();
    const next: Dismissed = { ...dismissed };

    for (const item of visible) {
      // Ang oras ng pinakabagong galaw ang itinatala, hindi ang oras ngayon —
      // kaya babalik ito kapag may mas bagong nangyari.
      next[item.id] = item.at ?? now;
    }

    setDismissed(next);
    await putCache(CacheKey.dismissedNotifications, next);
  }

  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      load();

      return () => {
        mounted.current = false;
      };
    }, [load])
  );

  // Ang itinago ay hindi na ipinapakita hangga't walang mas bagong galaw.
  const visible = items.filter((item) => isVisible(item, dismissed));

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
            onPress={() => goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={22} color={Colors.onPrimary} />
          </Pressable>

          <View style={styles.flex}>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>
              {visible.length > 0 ? `${visible.length} to review` : 'What needs your attention'}
            </Text>
          </View>

          {visible.length > 0 && (
            <Pressable
              style={({ pressed }) => [styles.clear, pressed && styles.backPressed]}
              onPress={clearAll}
              accessibilityRole="button">
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }>
        {!!error && (
          <Pressable style={styles.banner} onPress={() => load()}>
            <Ionicons name="cloud-offline-outline" size={20} color={Colors.danger} />
            <View style={styles.flex}>
              <Text style={styles.bannerTitle}>{error}</Text>
              <Text style={styles.bannerHint}>Tap to retry</Text>
            </View>
          </Pressable>
        )}

        {visible.length === 0 && !error ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={34} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{loading ? 'Loading…' : 'All caught up'}</Text>
            {!loading && (
              <Text style={styles.emptyText}>
                No pending documents or new records in your barangay.
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {visible.map((item, index) => {
              const style = LEVEL[item.level] ?? LEVEL.info;

              return (
                <View
                  key={item.id}
                  style={[styles.row, index === visible.length - 1 && styles.lastRow]}>
                  <View style={[styles.icon, { backgroundColor: style.tint }]}>
                    <Ionicons name={style.icon} size={18} color={style.color} />
                  </View>

                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.rowBody}>{item.body}</Text>
                    {!!item.at && <Text style={styles.rowTime}>{relativeTime(item.at)}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}
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
  backPressed: {
    opacity: 0.7,
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
  clear: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.onPrimaryFaded,
  },
  clearText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
  content: {
    padding: Spacing.xl,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerLight,
  },
  bannerTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.danger,
  },
  bannerHint: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.danger,
  },
  list: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    ...Shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  rowBody: {
    marginTop: 2,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  rowTime: {
    marginTop: 4,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyText: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
