import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import type { ActivityItem } from '@/lib/api';
import { relativeTime } from '@/lib/format';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const STYLE: Record<ActivityItem['type'], { icon: IoniconName; tint: string; color: string }> = {
  resident: { icon: 'person-add', tint: Colors.primaryLight, color: Colors.primary },
  household: { icon: 'home', tint: Colors.warningLight, color: Colors.warning },
  document: { icon: 'document-text', tint: Colors.infoLight, color: Colors.info },
};

type ActivitySheetProps = {
  item: ActivityItem | null;
  onClose: () => void;
};

/**
 * Panel na umaangat mula sa ilalim, may buong detalye ng isang galaw.
 * Ang backend ang nagpapasya kung anong mga linya ang ipapakita — kaya
 * hindi na kailangang baguhin ang screen na ito kapag nadagdagan ang datos.
 */
export function ActivitySheet({ item, onClose }: ActivitySheetProps) {
  const insets = useSafeAreaInsets();
  const style = item ? (STYLE[item.type] ?? STYLE.resident) : STYLE.resident;

  return (
    <Modal
      visible={item !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      {/* Pagpindot sa labas ng panel ay pagsasara. */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.xl }]}
          onPress={(event) => event.stopPropagation()}>
          <View style={styles.handle} />

          {!!item && (
            <>
              <View style={styles.header}>
                <View style={[styles.icon, { backgroundColor: style.tint }]}>
                  <Ionicons name={style.icon} size={22} color={style.color} />
                </View>

                <View style={styles.flex}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.time}>{relativeTime(item.at)}</Text>
                </View>
              </View>

              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {item.details.length === 0 ? (
                  <Text style={styles.empty}>No extra details recorded.</Text>
                ) : (
                  item.details.map((detail, index) => (
                    <View
                      key={detail.label}
                      style={[styles.row, index === item.details.length - 1 && styles.lastRow]}>
                      <Text style={styles.label}>{detail.label}</Text>
                      <Text style={styles.value} numberOfLines={2}>
                        {String(detail.value)}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>

              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={onClose}
                accessibilityRole="button">
                <Text style={styles.buttonText}>Close</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(10, 42, 24, 0.45)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.header,
    borderTopRightRadius: Radius.header,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  flex: {
    flex: 1,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  time: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  label: {
    width: 120,
    fontSize: FontSize.sm,
    color: Colors.muted,
  },
  value: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
  },
  empty: {
    paddingVertical: Spacing.lg,
    fontSize: FontSize.sm,
    color: Colors.muted,
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.xl,
    height: 50,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: Colors.border,
  },
  buttonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
});
