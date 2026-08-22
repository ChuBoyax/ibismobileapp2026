import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';

import { formatDateInput, parseDateInput } from './types';

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  required?: boolean;
  error?: string;
  /** Walang petsang lampas ngayon — hal. araw ng kapanganakan o kamatayan. */
  notFuture?: boolean;
};

/**
 * Petsa bilang MM/DD/YYYY, sa dalawang paraan.
 *
 * NANATILI ANG PAG-TYPE, at hindi ito kapalit ng kalendaryo. Karamihan sa mga
 * petsa rito ay araw ng kapanganakan na dekada na ang layo: mas mabilis pang
 * tipahin ang 1965 kaysa mag-scroll pabalik ng animnapung taon. Pero hindi
 * lahat ng petsa ay malayo — ang petsa ng bakuna ay kadalasang kahapon o
 * ngayon lang — at doon mas mabilis ang isang pindot sa kalendaryo kaysa
 * walong digit.
 *
 * Kaya ang icon ng kalendaryo ay pindutan, hindi palamuti: ang nag-eencode
 * ang pumipili kung alin ang mas mabilis para sa petsang nasa harap niya.
 */
export function DateField({
  label,
  value,
  onChange,
  hint,
  required,
  error,
  notFuture,
}: DateFieldProps) {
  const [focused, setFocused] = useState(false);
  /* Sa iOS lang: walang imperative na API doon, kaya kailangang i-render ang
     picker sa loob ng sariling sheet. Sa Android ay dialog na ang binubuksan
     ng OS mismo, kaya walang estado ang kailangan. */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(null);
  const insets = useSafeAreaInsets();

  // Awtomatikong naglalagay ng "/" habang nagta-type para hindi na isipin
  // ng nag-eencode ang format.
  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
    onChange(parts.join('/'));
  };

  /* Saan magbubukas ang kalendaryo kapag wala pang laman ang field. Ang
     ngayon ang pinakamalapit na hula na mayroon tayo, at isang pindot lang
     ang layo ng taon sa Material picker. */
  const startFrom = parseDateInput(value) ?? new Date();
  const maximumDate = notFuture ? new Date() : undefined;

  function openPicker() {
    // Kung nakabukas ang keyboard mula sa pag-type, natatabunan nito ang
    // dialog sa Android — kaya isinasara muna bago magbukas.
    Keyboard.dismiss();

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: startFrom,
        mode: 'date',
        maximumDate,
        onValueChange: (_event, selected) => onChange(formatDateInput(selected)),
      });

      return;
    }

    setDraft(startFrom);
    setSheetOpen(true);
  }

  function confirmSheet() {
    if (draft) onChange(formatDateInput(draft));
    setSheetOpen(false);
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.asterisk}> *</Text>}
      </Text>

      <View style={[styles.field, focused && styles.fieldFocused, !!error && styles.fieldError]}>
        <Pressable
          onPress={openPicker}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Pumili ng petsa para sa ${label}`}>
          <Ionicons
            name="calendar-outline"
            size={20}
            color={error ? Colors.danger : focused ? Colors.primary : Colors.primaryDark}
          />
        </Pressable>

        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="MM/DD/YYYY"
          placeholderTextColor={Colors.muted}
          keyboardType="numeric"
          maxLength={10}
        />
      </View>

      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {!error && !!hint && <Text style={styles.hint}>{hint}</Text>}

      {/* iOS lang — sa Android ay ang dialog ng OS ang lumalabas. */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)} />

          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setSheetOpen(false)} hitSlop={10} accessibilityRole="button">
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={confirmSheet} hitSlop={10} accessibilityRole="button">
                <Text style={styles.done}>Done</Text>
              </Pressable>
            </View>

            {!!draft && (
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                maximumDate={maximumDate}
                onValueChange={(_event, selected) => setDraft(selected)}
              />
            )}
          </View>
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
    height: 52,
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
  fieldFocused: {
    borderColor: Colors.primary,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: 0,
  },
  hint: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
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
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    ...Shadow.raised,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  cancel: {
    fontSize: FontSize.md,
    color: Colors.muted,
  },
  done: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
});
