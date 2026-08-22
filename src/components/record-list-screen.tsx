import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter, type Href } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_HEIGHT } from '@/components/animated-tab-bar';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export type RecordItem = {
  id: string;
  title: string;
  subtitle: string;
  /** Maiikling tatak sa ilalim ng bawat card — purok, sektor, bilang. */
  tags: string[];
};

type RecordListScreenProps = {
  title: string;
  subtitle: string;
  icon: IoniconName;
  /** Ruta ng form na bubuksan ng pindutang "bago". */
  createHref: Href;
  createLabel: string;
  /*
    Ruta ng buod ng isang umiiral nang tala. Ang id ay idinurugtong dito kapag
    pinindot ang isang card.

    BUOD ANG BINUBUKSAN NITO, HINDI ANG FORM. Ang pinakakaraniwang dahilan ng
    pagpindot ay tingnan ang tala, hindi baguhin — at ang stepper ay nasa likod
    pa ng pindutang "Edit" doon.

    ANG BUONG CARD ANG PINDUTAN, hindi isang maliit na icon sa gilid. Ang
    chevron sa dulo ay matagal nang nakaguhit doon — nangako na iyon ng
    pagbukas kahit wala pang nangyayari.
  */
  openHref: (id: string) => Href;
  items: RecordItem[];
  total: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
};

/**
 * Karaniwang anyo ng mga tab na listahan (residente, pamilya, sambahayan).
 *
 * Iisang component para pare-pareho ang search, pull-to-refresh at pindutang
 * pandagdag sa tatlong module.
 */
export function RecordListScreen({
  title,
  subtitle,
  icon,
  createHref,
  createLabel,
  openHref,
  items,
  total,
  loading,
  refreshing,
  error,
  search,
  onSearchChange,
  onRefresh,
}: RecordListScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScreenHeader title={title} subtitle={subtitle} action="funnel-outline" />

      <View style={styles.toolbar}>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={18} color={Colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={onSearchChange}
            placeholder={`Search ${title.toLowerCase()}`}
            placeholderTextColor={Colors.muted}
            autoCorrect={false}
          />
          {!!search && (
            <Pressable onPress={() => onSearchChange('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={Colors.muted} />
            </Pressable>
          )}
        </View>

        <Text style={styles.count}>
          {loading ? 'Loading…' : `${total} record${total === 1 ? '' : 's'}`}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            // Puwang para hindi matabunan ng lumulutang na tab bar at ng
            // pindutang "New" ang huling card.
            { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 84 },
            items.length === 0 && styles.listEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyRing, !!error && styles.emptyRingError]}>
                <Ionicons
                  name={error ? 'cloud-offline-outline' : icon}
                  size={32}
                  color={error ? Colors.danger : Colors.primary}
                />
              </View>

              {/* Walang laman ang listahan sa tatlong magkaibang dahilan, at
                  magkaiba rin ang dapat sabihin sa bawat isa. Ang "Cannot load
                  records" sa lahat ng kaso ay parang sira ang app, gayong
                  minsan ay wala lang talagang tala o wala lang signal. */}
              <Text style={styles.emptyTitle}>
                {error ? 'Nothing saved on this device' : 'No records found'}
              </Text>
              <Text style={styles.emptyText}>
                {error
                  ? `${error} Records you have opened before will still show here.`
                  : search
                    ? 'No match for your search. Try a different word.'
                    : 'No records here yet. Start with the New button.'}
              </Text>

              {!!error && (
                <Pressable style={styles.retry} onPress={onRefresh} accessibilityRole="button">
                  <Ionicons name="refresh" size={18} color={Colors.onPrimary} />
                  <Text style={styles.retryLabel}>Try again</Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item, index }) => (
            // Hiwalay ang Animated.View sa Pressable: hindi tumatanggap ng
            // style na function ang animated na Pressable, kaya nawawala ang
            // anyo ng card kapag pinagsama sila sa iisang element.
            <Animated.View
              // Sunod-sunod na pagpasok ng mga card sa halip na sabay-sabay —
              // may direksyon ang paglitaw ng listahan imbes na biglang buo.
              entering={FadeInDown.delay(Math.min(index, 8) * 35)
                .duration(260)
                .springify()
                .damping(18)}>
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => router.push(openHref(item.id))}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.title}`}>
                <View style={styles.avatar}>
                  <Ionicons name={icon} size={20} color={Colors.primary} />
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1}>
                    {item.subtitle}
                  </Text>

                  {item.tags.length > 0 && (
                    <View style={styles.tags}>
                      {item.tags.map((tag) => (
                        <View key={tag} style={styles.tag}>
                          <Text style={styles.tagLabel}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
              </Pressable>
            </Animated.View>
          )}
        />
      )}

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.lg }]}
        onPress={() => router.push(createHref)}
        accessibilityRole="button"
        accessibilityLabel={createLabel}>
        <Ionicons name="add" size={22} color={Colors.onPrimary} />
        <Text style={styles.fabLabel}>{createLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    height: 46,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: 0,
  },
  count: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.muted,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: Spacing.lg,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    ...Shadow.card,
  },
  cardPressed: {
    backgroundColor: Colors.primaryLight,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  cardSubtitle: {
    marginTop: 1,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
  },
  tagLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyRing: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyRingError: {
    backgroundColor: Colors.dangerLight,
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
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 48,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  retryLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 52,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    ...Shadow.raised,
  },
  fabLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
});
