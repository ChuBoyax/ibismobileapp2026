import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SelectOption } from '@/constants/form-options';
import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';

import type { IoniconName } from './types';

type SelectFieldProps = {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  icon?: IoniconName;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  error?: string;
};

/** Kapag mahaba ang listahan, may search bar na para hindi nakakapagod mag-scroll. */
const SEARCHABLE_THRESHOLD = 8;

export function SelectField({
  label,
  value,
  onChange,
  options,
  icon,
  placeholder = 'Select an option',
  hint,
  required,
  error,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();

  const selected = options.find((option) => option.value === value);
  const searchable = options.length > SEARCHABLE_THRESHOLD;

  const results = useMemo(() => {
    if (!query.trim()) return options;
    const needle = query.trim().toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.asterisk}> *</Text>}
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.field,
          pressed && styles.fieldPressed,
          !!error && styles.fieldError,
        ]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${selected ? selected.label : 'Walang napili'}`}>
        {!!icon && <Ionicons name={icon} size={20} color={Colors.muted} />}
        <Text style={[styles.valueText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={Colors.muted} />
      </Pressable>

      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {!error && !!hint && <Text style={styles.hint}>{hint}</Text>}

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>{label}</Text>

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
              {!!query && (
                <Pressable onPress={() => setQuery('')} hitSlop={10}>
                  <Ionicons name="close-circle" size={18} color={Colors.muted} />
                </Pressable>
              )}
            </View>
          )}

          <FlatList
            data={results}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>No matching option.</Text>}
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                  onPress={() => {
                    onChange(item.value);
                    close();
                  }}
                  accessibilityRole="button">
                  <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                    {item.label}
                  </Text>
                  {active && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  asterisk: {
    color: Colors.danger,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  fieldError: {
    borderColor: Colors.danger,
  },
  errorText: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    color: Colors.danger,
  },
  fieldPressed: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  valueText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  placeholder: {
    color: Colors.muted,
  },
  hint: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 42, 24, 0.45)',
  },
  sheet: {
    // Hindi buong screen para makita pa rin ang form sa likod — mas malinaw
    // na pansamantala lang ang pagpili.
    maxHeight: '70%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    ...Shadow.raised,
  },
  grabber: {
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
    marginBottom: Spacing.lg,
  },
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
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: 0,
  },
  list: {
    marginHorizontal: -Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  optionPressed: {
    backgroundColor: Colors.primaryLight,
  },
  optionLabel: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  optionLabelActive: {
    fontWeight: '700',
    color: Colors.primary,
  },
  empty: {
    paddingVertical: Spacing.xl,
    textAlign: 'center',
    fontSize: FontSize.md,
    color: Colors.muted,
  },
});
