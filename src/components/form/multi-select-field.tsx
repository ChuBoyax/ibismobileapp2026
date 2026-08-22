import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SelectOption } from '@/constants/form-options';
import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';

type MultiSelectFieldProps = {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
  error?: string;
};

const SEARCHABLE_THRESHOLD = 8;

/**
 * Para sa mga field na tumatanggap ng higit sa isang sagot, tulad ng
 * citizenship na array sa database. Nananatiling bukas ang sheet habang
 * pumipili — karaniwang sunod-sunod ang pagpili kapag marami ang kukunin.
 */
export function MultiSelectField({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select options',
  hint,
  required,
  error,
}: MultiSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();

  const selected = options.filter((option) => value.includes(option.value));
  const searchable = options.length > SEARCHABLE_THRESHOLD;

  const results = useMemo(() => {
    if (!query.trim()) return options;
    const needle = query.trim().toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  const toggle = (optionValue: string) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue]
    );
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.asterisk}> *</Text>}
      </Text>

      <Pressable
        style={[styles.field, !!error && styles.fieldError]}
        onPress={() => setOpen(true)}
        accessibilityRole="button">
        <View style={styles.chips}>
          {selected.length === 0 ? (
            <Text style={styles.placeholder}>{placeholder}</Text>
          ) : (
            selected.map((option) => (
              <View key={option.value} style={styles.chip}>
                <Text style={styles.chipLabel}>{option.label}</Text>
              </View>
            ))
          )}
        </View>
        <Ionicons name="chevron-down" size={18} color={Colors.muted} />
      </Pressable>

      {!!error && <Text style={styles.error}>{error}</Text>}
      {!error && !!hint && <Text style={styles.hint}>{hint}</Text>}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

          <View
            style={[
              styles.sheet,
              searchable && styles.sheetFixed,
              { paddingBottom: Math.max(insets.bottom, Spacing.lg) },
            ]}>
            <View style={styles.grabber} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityRole="button">
                <Text style={styles.done}>Done</Text>
              </Pressable>
            </View>

            {searchable && (
              <View style={styles.search}>
                <Ionicons name="search-outline" size={18} color={Colors.muted} />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search"
                  placeholderTextColor={Colors.muted}
                  autoCorrect={false}
                />
              </View>
            )}

            <FlatList
              data={results}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListEmptyComponent={<Text style={styles.empty}>No matching option.</Text>}
              renderItem={({ item }) => {
                const checked = value.includes(item.value);

                return (
                  <Pressable
                    style={styles.option}
                    onPress={() => toggle(item.value)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}>
                    <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                      {checked && <Ionicons name="checkmark" size={15} color={Colors.onPrimary} />}
                    </View>
                    <Text style={styles.optionLabel}>{item.label}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.lg },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  asterisk: { color: Colors.danger },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  fieldError: { borderColor: Colors.danger },
  chips: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
  },
  chipLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
  placeholder: { fontSize: FontSize.md, color: Colors.muted },
  hint: { marginTop: Spacing.xs, fontSize: FontSize.xs, color: Colors.muted },
  error: { marginTop: Spacing.xs, fontSize: FontSize.xs, color: Colors.danger },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 42, 24, 0.45)',
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    ...Shadow.raised,
  },
  /* Tingnan ang `select-field.tsx` — iisa ang dahilan: hindi dapat umuurong
     ang sheet sa bawat titik ng paghahanap. */
  sheetFixed: {
    height: '70%',
  },
  list: {
    flex: 1,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  done: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    height: 46,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionLabel: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  empty: {
    paddingVertical: Spacing.xl,
    textAlign: 'center',
    fontSize: FontSize.md,
    color: Colors.muted,
  },
});
