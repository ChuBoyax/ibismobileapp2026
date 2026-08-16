import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  required?: boolean;
  error?: string;
};

/**
 * Petsa bilang MM/DD/YYYY. Sinadyang teksto lang at hindi calendar modal:
 * karamihan sa mga petsa rito ay araw ng kapanganakan na dekada na ang layo,
 * kaya mas mabilis pang i-type kaysa mag-scroll pabalik ng kalendaryo.
 */
export function DateField({ label, value, onChange, hint, required, error }: DateFieldProps) {
  const [focused, setFocused] = useState(false);

  // Awtomatikong naglalagay ng "/" habang nagta-type para hindi na isipin
  // ng nag-eencode ang format.
  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
    onChange(parts.join('/'));
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.asterisk}> *</Text>}
      </Text>

      <View style={[styles.field, focused && styles.fieldFocused, !!error && styles.fieldError]}>
        <Ionicons
          name="calendar-outline"
          size={20}
          color={error ? Colors.danger : focused ? Colors.primary : Colors.muted}
        />
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
});
