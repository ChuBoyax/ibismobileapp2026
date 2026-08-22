import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RequireAuth } from '@/components/require-auth';
import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { relativeTime } from '@/lib/format';
import { goBack } from '@/lib/navigation';
import {
  listSummaries,
  overrideConflict,
  remove,
  type OutboxSummary,
  type OutboxType,
} from '@/lib/outbox';
import { clearHistory, history, type SyncEntry } from '@/lib/sync-history';
import { drain, subscribe } from '@/lib/sync';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_LABEL: Record<OutboxType, string> = {
  resident: 'Resident',
  household: 'Household',
  family: 'Family',
};

const TYPE_ICON: Record<OutboxType, IoniconName> = {
  resident: 'person',
  household: 'home',
  family: 'people',
};

/** Ilan sa mga naipadala na ang ipinapakita sa ilalim. */
const HISTORY_SHOWN = 20;

/** Kailangan ng token — hindi mai-sync ang anuman kung hindi naka-login. */
export default function GuardedSyncScreen() {
  return (
    <RequireAuth>
      <SyncScreen />
    </RequireAuth>
  );
}

type Group = 'conflict' | 'needsFix' | 'waiting';

const GROUP_LABEL: Record<Group, string> = {
  /* Sariling pangkat ang conflict at hindi kasama sa "needs fixing": walang
     maling datos doon. Ang tanong ay kung kaninong bersyon ang mananaig — at
     tao lang ang makasasagot niyan. */
  conflict: 'CHANGED BY SOMEONE ELSE',
  needsFix: 'NEEDS FIXING',
  waiting: 'WAITING TO SEND',
};

/**
 * Isang patag na listahan ng pamagat at hilera — ang PILA lamang.
 *
 * PINATAG PARA MAI-VIRTUALIZE. Dati'y tatlong nakapugad na `map` ito sa loob
 * ng isang `ScrollView`, kaya nakabuo ng hilera ang BAWAT tala sa pila kahit
 * ang nakikita lang ng mata ay anim. Sa isang daang naghihintay na tala — ang
 * mismong dahilan kung bakit may screen na ito — daan-daang view ang nabubuo,
 * at nagagawa itong muli sa tuwing may umuusad sa sync.
 *
 * Ang pila lang ang pinapatag dahil ito lang ang walang hangganan. Ang talaan
 * ng naipadala ay may takda (`HISTORY_SHOWN`), kaya nananatili itong payak sa
 * ilalim ng listahan — walang napapala sa pagpapagulo ng bagay na dalawampu
 * lang ang katapat.
 */
type Entry =
  | { kind: 'header'; key: string; label: string }
  | {
      kind: 'row';
      key: string;
      item: OutboxSummary;
      group: Group;
      first: boolean;
      last: boolean;
    };

function SyncScreen() {
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<OutboxSummary[]>([]);
  const [sent, setSent] = useState<SyncEntry[]>([]);
  const [running, setRunning] = useState(false);
  /** Bilang ng naipadala sa katatapos na pagsubok — ito ang berdeng abiso. */
  const [justSynced, setJustSynced] = useState(0);

  const load = useCallback(async () => {
    // Sinasadyang walang payload ang binabasa sa pila — tingnan ang
    // `listSummaries`. Ang payload ang pinakamabigat na bahagi ng bawat hilera
    // at wala namang ginagamit dito ang screen, gayong sa bawat pag-usad ng
    // sync ito binabasang muli.
    const [queued, done] = await Promise.all([listSummaries(), history(HISTORY_SHOWN)]);

    setItems(queued);
    setSent(done);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void load();

      // Nire-refresh ang listahan tuwing may nagbabago sa sync engine, kaya
      // nakikita ang pag-usad nang hindi kailangang mag-pull.
      const unsubscribe = subscribe((state) => {
        if (!active) return;

        setRunning(state.running);

        // Habang tumatakbo, hindi pa tapos ang bilang — sa dulo lang ito
        // may kahulugan, kaya doon lang ito ipinapakita.
        if (!state.running) setJustSynced(state.justSynced);

        void load();
      });

      return () => {
        active = false;
        unsubscribe();
      };
    }, [load])
  );

  const confirmDiscard = useCallback(
    (item: OutboxSummary) => {
      Alert.alert(
        'Discard this record?',
        `${item.label ?? TYPE_LABEL[item.type]} will be deleted from this device and never sent. This cannot be undone.`,
        [
          { text: 'Keep', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: async () => {
              await remove(item.uuid);
              await load();
            },
          },
        ]
      );
    },
    [load]
  );

  /**
   * Sinasadyang pagpapasiya: ang bersyon sa cellphone ang mananaig.
   * Ipinapakita muna ang sasapitin — nakabura ito ng trabaho ng iba.
   */
  const confirmOverride = useCallback(
    (item: OutboxSummary) => {
      Alert.alert(
        'Keep your version?',
        'The changes made by the other person will be replaced by yours. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Keep mine',
            style: 'destructive',
            onPress: async () => {
              await overrideConflict(item.uuid);
              await load();
              void drain();
            },
          },
        ]
      );
    },
    [load]
  );

  const openFix = useCallback((item: OutboxSummary) => {
    router.push(`/registration/${item.type}?draft=${item.uuid}` as never);
  }, []);

  const confirmClearHistory = useCallback(() => {
    Alert.alert(
      'Clear the sent list?',
      'This only clears the list on this device. The records themselves stay in the barangay registry.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearHistory();
            await load();
          },
        },
      ]
    );
  }, [load]);

  const waitingCount = items.filter(
    (item) => item.status !== 'needs_fix' && item.status !== 'conflict'
  ).length;

  const entries = useMemo(() => {
    const groups: { group: Group; rows: OutboxSummary[] }[] = [
      { group: 'conflict', rows: items.filter((item) => item.status === 'conflict') },
      { group: 'needsFix', rows: items.filter((item) => item.status === 'needs_fix') },
      {
        group: 'waiting',
        rows: items.filter(
          (item) => item.status !== 'needs_fix' && item.status !== 'conflict'
        ),
      },
    ];

    const result: Entry[] = [];

    for (const { group, rows } of groups) {
      if (rows.length === 0) continue;

      result.push({ kind: 'header', key: `header-${group}`, label: GROUP_LABEL[group] });

      rows.forEach((item, index) => {
        result.push({
          kind: 'row',
          key: item.uuid,
          item,
          group,
          first: index === 0,
          last: index === rows.length - 1,
        });
      });
    }

    return result;
  }, [items]);

  const renderItem = useCallback(
    ({ item: entry }: { item: Entry }) => {
      if (entry.kind === 'header') {
        return <Text style={styles.groupLabel}>{entry.label}</Text>;
      }

      return (
        <Row
          item={entry.item}
          first={entry.first}
          last={entry.last}
          onFix={entry.group === 'waiting' ? undefined : openFix}
          fixLabel={entry.group === 'conflict' ? 'Review' : 'Fix'}
          onOverride={entry.group === 'conflict' ? confirmOverride : undefined}
          onDiscard={confirmDiscard}
        />
      );
    },
    [openFix, confirmOverride, confirmDiscard]
  );

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
            <Text style={styles.title}>Sync queue</Text>
            <Text style={styles.subtitle}>
              {items.length === 0
                ? 'Everything is sent'
                : `${items.length} record${items.length === 1 ? '' : 's'} on this device`}
            </Text>
          </View>

          {waitingCount > 0 && (
            <Pressable
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
              onPress={() => void drain()}
              disabled={running}
              accessibilityRole="button">
              <Text style={styles.retryText}>{running ? 'Syncing…' : 'Retry'}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(entry) => entry.key}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        // Sapat para mapuno ang unang tanawin nang hindi binubuo ang lahat.
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        ListHeaderComponent={
          /* ANG PATUNAY NG TAGUMPAY.

             Dati, ang tanging nakikita pagkatapos magpadala ay ang paglaho ng
             laman ng pila — kaparehong hitsura ng talang tahimik na nawala.
             Ito ang nagpapaiba sa dalawa, at nananatili hanggang sa susunod na
             pagsubok kaya hindi ito napapalampas ng hindi nakatingin. */
          justSynced > 0 ? (
            <View style={styles.success}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
              <Text style={styles.successText}>
                {justSynced} record{justSynced === 1 ? '' : 's'} sent successfully.
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="cloud-done-outline" size={34} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>All synced</Text>
            <Text style={styles.emptyText}>
              {sent.length > 0
                ? 'Nothing is waiting. Everything you saved has reached the barangay registry.'
                : 'Records you save without a connection will wait here until the signal comes back.'}
            </Text>
          </View>
        }
        ListFooterComponent={
          sent.length > 0 ? (
            <>
              <View style={styles.groupRow}>
                <Text style={styles.groupLabel}>SENT</Text>
                <Pressable onPress={confirmClearHistory} hitSlop={10} accessibilityRole="button">
                  <Text style={styles.clearLink}>Clear list</Text>
                </Pressable>
              </View>

              <View style={styles.list}>
                {sent.map((entry, index) => (
                  <View
                    key={entry.id}
                    style={[styles.sentRow, index === sent.length - 1 && styles.lastSentRow]}>
                    <View style={styles.sentIcon}>
                      <Ionicons name="checkmark" size={14} color={Colors.primary} />
                    </View>

                    <View style={styles.flex}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {entry.label || TYPE_LABEL[entry.type]}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {/* Malaki ang pagkakaiba ng bagong tala at ng pagwawasto
                            kapag binabalikan mo kung ano ang nangyari. */}
                        {TYPE_LABEL[entry.type]} {entry.action === 'updated' ? 'updated' : 'added'} ·{' '}
                        {relativeTime(entry.syncedAt.toISOString())}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text style={styles.footnote}>
                The last {sent.length} sent from this device. Older ones are removed to save space.
              </Text>
            </>
          ) : null
        }
      />
    </View>
  );
}

/**
 * NAKA-MEMO ANG HILERA, AT MAY SARILING PAGHAHAMBING.
 *
 * Bagong bagay ang nabubuo sa bawat pagbabasa ng listahan, kaya kahit walang
 * nagbago sa isang tala ay iba na ang pagkakakilanlan nito at magre-render
 * muli ang buong hilera. Sa isang daang tala na dumadaan sa isa-isang
 * pagpapadala, iyon ay libo-libong render na walang ipinagbago sa mata.
 *
 * Kaya inihahambing ang mga pinagmumulan ng laman, hindi ang bagay mismo.
 */
type RowProps = {
  item: OutboxSummary;
  first: boolean;
  last: boolean;
  onFix?: (item: OutboxSummary) => void;
  fixLabel?: string;
  onOverride?: (item: OutboxSummary) => void;
  onDiscard: (item: OutboxSummary) => void;
};

const Row = memo(function Row({
  item,
  first,
  last,
  onFix,
  fixLabel = 'Fix',
  onOverride,
  onDiscard,
}: RowProps) {
  const broken = item.status === 'needs_fix' || item.status === 'conflict';

  return (
    <View style={[styles.row, first && styles.firstRow, last && styles.lastRow]}>
      <View style={styles.rowTop}>
        <View style={[styles.icon, broken ? styles.iconDanger : styles.iconNeutral]}>
          <Ionicons
            name={TYPE_ICON[item.type]}
            size={16}
            color={broken ? Colors.danger : Colors.primary}
          />
        </View>

        <View style={styles.flex}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.label || TYPE_LABEL[item.type]}
          </Text>
          <Text style={styles.rowMeta}>
            {/* Malaki ang pagkakaiba ng "bagong tala" at "pagbabago" kapag
                nagpapasiya kung itatapon ito — kaya nakasulat. */}
            {item.recordId ? 'Edited' : TYPE_LABEL[item.type]} · saved{' '}
            {relativeTime(item.createdAt.toISOString())}
          </Text>
        </View>

        {item.status === 'syncing' && <Ionicons name="sync" size={16} color={Colors.info} />}
      </View>

      {/* Ipinapakita ang dahilan kahit hindi pa tuluyang nabigo. Kung
          itatago ito hanggang sumuko, ang user na paulit-ulit nang sumasablay
          ay walang makikitang pahiwatig kung bakit — at wala siyang masasabi
          sa kahit sino kapag humingi siya ng tulong. */}
      {!!item.lastError && (
        <Text style={[styles.error, !broken && styles.warning]}>
          {item.lastError}
          {!broken && item.attempts > 0 ? `  (${item.attempts} tries)` : ''}
        </Text>
      )}

      <View style={styles.actions}>
        {!!onFix && (
          <Pressable
            style={({ pressed }) => [styles.action, styles.fix, pressed && styles.pressed]}
            onPress={() => onFix(item)}
            accessibilityRole="button">
            <Ionicons name="create-outline" size={15} color={Colors.onPrimary} />
            <Text style={styles.fixText}>{fixLabel}</Text>
          </Pressable>
        )}

        {!!onOverride && (
          <Pressable
            style={({ pressed }) => [styles.action, styles.override, pressed && styles.pressed]}
            onPress={() => onOverride(item)}
            accessibilityRole="button">
            <Ionicons name="cloud-upload-outline" size={15} color={Colors.text} />
            <Text style={styles.overrideText}>Keep mine</Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [styles.action, styles.discard, pressed && styles.pressed]}
          onPress={() => onDiscard(item)}
          accessibilityRole="button">
          <Ionicons name="trash-outline" size={15} color={Colors.danger} />
          <Text style={styles.discardText}>Discard</Text>
        </Pressable>
      </View>
    </View>
  );
},
(prev, next) =>
  prev.first === next.first &&
  prev.last === next.last &&
  prev.fixLabel === next.fixLabel &&
  prev.onFix === next.onFix &&
  prev.onOverride === next.onOverride &&
  prev.onDiscard === next.onDiscard &&
  prev.item.uuid === next.item.uuid &&
  prev.item.type === next.item.type &&
  prev.item.label === next.item.label &&
  prev.item.status === next.item.status &&
  prev.item.attempts === next.item.attempts &&
  prev.item.lastError === next.item.lastError &&
  prev.item.recordId === next.item.recordId &&
  prev.item.createdAt.getTime() === next.item.createdAt.getTime());

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
  retry: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.onPrimaryFaded,
  },
  retryText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
  content: {
    padding: Spacing.xl,
  },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
  },
  successText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearLink: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.muted,
  },
  sentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sentIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footnote: {
    marginTop: Spacing.md,
    marginHorizontal: Spacing.xs,
    fontSize: 11,
    color: Colors.muted,
  },
  groupLabel: {
    marginTop: Spacing.lg,
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
  /*
    ANG CARD NG PILA AY GAWA NG MGA HILERA MISMO, HINDI NG BALOT NA VIEW.

    Kailangan nito ng virtualization: ang mga hilera ng pila ay magkakapatid na
    sa FlatList at wala nang iisang magulang na maaaring bigyan ng bilog na
    gilid. Kaya ang unang hilera ang may dalang itaas na kurba at ang huli ang
    may ibaba — at dahil magkadikit at opaque ang mga ito, ang anino ng bawat
    hilera ay natatakpan ng kasunod, at ang natitirang nakikita ay ang anino ng
    buong pangkat.

    Ang talaan ng naipadala ay nananatili sa loob ng `list` — may takda ang
    haba nito, kaya walang virtualization na kailangan doon.
  */
  row: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    ...Shadow.card,
  },
  firstRow: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  lastRow: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  lastSentRow: {
    borderBottomWidth: 0,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconNeutral: {
    backgroundColor: Colors.primaryLight,
  },
  iconDanger: {
    backgroundColor: Colors.dangerLight,
  },
  rowTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  rowMeta: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  error: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    backgroundColor: Colors.dangerLight,
    fontSize: FontSize.xs,
    color: Colors.danger,
    lineHeight: 17,
  },
  warning: {
    backgroundColor: Colors.warningLight,
    color: Colors.warning,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
  },
  fix: {
    backgroundColor: Colors.primary,
  },
  fixText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
  override: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  overrideText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text,
  },
  discard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.dangerLight,
  },
  discardText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.danger,
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
