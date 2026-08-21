import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RequireAuth } from '@/components/require-auth';
import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { relativeTime } from '@/lib/format';
import { goBack } from '@/lib/navigation';
import { list, overrideConflict, remove, type OutboxItem, type OutboxType } from '@/lib/outbox';
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

/** Kailangan ng token — hindi mai-sync ang anuman kung hindi naka-login. */
export default function GuardedSyncScreen() {
  return (
    <RequireAuth>
      <SyncScreen />
    </RequireAuth>
  );
}

function SyncScreen() {
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<OutboxItem[]>([]);
  const [sent, setSent] = useState<SyncEntry[]>([]);
  const [running, setRunning] = useState(false);
  /** Bilang ng naipadala sa katatapos na pagsubok — ito ang berdeng abiso. */
  const [justSynced, setJustSynced] = useState(0);

  const load = useCallback(async () => {
    const [queued, done] = await Promise.all([list(), history(20)]);

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

  function confirmDiscard(item: OutboxItem) {
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
  }

  /**
   * Sinasadyang pagpapasiya: ang bersyon sa cellphone ang mananaig.
   * Ipinapakita muna ang sasapitin — nakabura ito ng trabaho ng iba.
   */
  function confirmOverride(item: OutboxItem) {
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
  }

  function confirmClearHistory() {
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
  }

  const conflicts = items.filter((item) => item.status === 'conflict');
  const needsFix = items.filter((item) => item.status === 'needs_fix');
  const waiting = items.filter(
    (item) => item.status !== 'needs_fix' && item.status !== 'conflict'
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

          {waiting.length > 0 && (
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

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}>
        {/* ANG PATUNAY NG TAGUMPAY.

            Dati, ang tanging nakikita pagkatapos magpadala ay ang paglaho ng
            laman ng pila — kaparehong hitsura ng talang tahimik na nawala.
            Ito ang nagpapaiba sa dalawa, at nananatili hanggang sa susunod na
            pagsubok kaya hindi ito napapalampas ng hindi nakatingin. */}
        {justSynced > 0 && (
          <View style={styles.success}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
            <Text style={styles.successText}>
              {justSynced} record{justSynced === 1 ? '' : 's'} sent successfully.
            </Text>
          </View>
        )}

        {items.length === 0 ? (
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
        ) : (
          <>
            {conflicts.length > 0 && (
              <>
                {/* Sariling pangkat ito at hindi kasama sa "needs fixing":
                    walang maling datos dito. Ang tanong ay kung kaninong
                    bersyon ang mananaig — at tao lang ang makasasagot niyan. */}
                <Text style={styles.groupLabel}>CHANGED BY SOMEONE ELSE</Text>
                <View style={styles.list}>
                  {conflicts.map((item, index) => (
                    <Row
                      key={item.uuid}
                      item={item}
                      last={index === conflicts.length - 1}
                      onFix={() =>
                        router.push(`/registration/${item.type}?draft=${item.uuid}` as never)
                      }
                      fixLabel="Review"
                      onOverride={() => confirmOverride(item)}
                      onDiscard={() => confirmDiscard(item)}
                    />
                  ))}
                </View>
              </>
            )}

            {needsFix.length > 0 && (
              <>
                <Text style={styles.groupLabel}>NEEDS FIXING</Text>
                <View style={styles.list}>
                  {needsFix.map((item, index) => (
                    <Row
                      key={item.uuid}
                      item={item}
                      last={index === needsFix.length - 1}
                      onFix={() =>
                        router.push(`/registration/${item.type}?draft=${item.uuid}` as never)
                      }
                      onDiscard={() => confirmDiscard(item)}
                    />
                  ))}
                </View>
              </>
            )}

            {waiting.length > 0 && (
              <>
                <Text style={styles.groupLabel}>WAITING TO SEND</Text>
                <View style={styles.list}>
                  {waiting.map((item, index) => (
                    <Row
                      key={item.uuid}
                      item={item}
                      last={index === waiting.length - 1}
                      onDiscard={() => confirmDiscard(item)}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {sent.length > 0 && (
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
                  style={[styles.sentRow, index === sent.length - 1 && styles.lastRow]}>
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
        )}
      </ScrollView>
    </View>
  );
}

function Row({
  item,
  last,
  onFix,
  fixLabel = 'Fix',
  onOverride,
  onDiscard,
}: {
  item: OutboxItem;
  last: boolean;
  onFix?: () => void;
  fixLabel?: string;
  onOverride?: () => void;
  onDiscard: () => void;
}) {
  const broken = item.status === 'needs_fix' || item.status === 'conflict';

  return (
    <View style={[styles.row, last && styles.lastRow]}>
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
            onPress={onFix}
            accessibilityRole="button">
            <Ionicons name="create-outline" size={15} color={Colors.onPrimary} />
            <Text style={styles.fixText}>{fixLabel}</Text>
          </Pressable>
        )}

        {!!onOverride && (
          <Pressable
            style={({ pressed }) => [styles.action, styles.override, pressed && styles.pressed]}
            onPress={onOverride}
            accessibilityRole="button">
            <Ionicons name="cloud-upload-outline" size={15} color={Colors.text} />
            <Text style={styles.overrideText}>Keep mine</Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [styles.action, styles.discard, pressed && styles.pressed]}
          onPress={onDiscard}
          accessibilityRole="button">
          <Ionicons name="trash-outline" size={15} color={Colors.danger} />
          <Text style={styles.discardText}>Discard</Text>
        </Pressable>
      </View>
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
  row: {
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  lastRow: {
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
