import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

export type FilterOption = {
  /** null ang ibig sabihin ay "lahat" — walang sinasala. */
  value: string | number | null;
  label: string;
};

export type FilterGroup = {
  key: string;
  /** Pangalan ng dimensyon, hal. "Purok". */
  label: string;
  options: FilterOption[];
  selected: string | number | null;
  onSelect: (value: string | number | null) => void;
};

/**
 * Isang hanay ng filter sa itaas ng ulat.
 *
 * Tatlong tuntunin:
 *  1. ISANG HANAY LANG, sa itaas. Hindi kada chart may sariling filter —
 *     kundi magkakasalungat ang mga numero sa iisang screen.
 *  2. SAKOP NITO LAHAT ng nasa ibaba. Kapag pumili ka ng purok, lahat ng
 *     seksyon ay ulat na ng purok na iyon.
 *  3. NAKIKITA AGAD ANG NAPILI kahit hindi buksan ang picker — nasa mismong
 *     chip ang halaga, hindi lang ang pangalan ng dimensyon.
 */
export function FilterBar({ groups, onClear }: { groups: FilterGroup[]; onClear: () => void }) {
  const [open, setOpen] = useState<FilterGroup | null>(null);
  const insets = useSafeAreaInsets();

  const active = groups.filter((group) => group.selected !== null);

  return (
    <>
      <View style={styles.bar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.barContent}>
          {groups.map((group) => {
            const current = group.options.find((option) => option.value === group.selected);
            const isActive = group.selected !== null;

            return (
              <Pressable
                key={group.key}
                style={({ pressed }) => [
                  styles.chip,
                  isActive && styles.chipActive,
                  pressed && styles.chipPressed,
                ]}
                onPress={() => setOpen(group)}
                accessibilityRole="button">
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {isActive ? current?.label ?? group.label : group.label}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={13}
                  color={isActive ? Colors.onPrimary : Colors.muted}
                />
              </Pressable>
            );
          })}

          {active.length > 0 && (
            <Pressable
              style={({ pressed }) => [styles.clear, pressed && styles.chipPressed]}
              onPress={onClear}
              accessibilityRole="button">
              <Ionicons name="close" size={14} color={Colors.danger} />
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      <Modal
        visible={open !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(null)}
        statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.xl }]}
            onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{open?.label}</Text>

            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {open?.options.map((option, index) => {
                const selected = option.value === open.selected;

                return (
                  <Pressable
                    key={`${option.value}`}
                    style={({ pressed }) => [
                      styles.option,
                      index === open.options.length - 1 && styles.lastOption,
                      pressed && styles.optionPressed,
                    ]}
                    onPress={() => {
                      open.onSelect(option.value);
                      setOpen(null);
                    }}
                    accessibilityRole="button">
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {option.label}
                    </Text>
                    {selected && (
                      <Ionicons name="checkmark" size={18} color={Colors.primary} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.background,
  },
  barContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.onPrimary,
  },
  clear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dangerLight,
  },
  clearText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.danger,
  },

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
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  sheetTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  lastOption: {
    borderBottomWidth: 0,
  },
  optionPressed: {
    opacity: 0.6,
  },
  optionText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  optionTextSelected: {
    fontWeight: '700',
    color: Colors.primary,
  },
});
