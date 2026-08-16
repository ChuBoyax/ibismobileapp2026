import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

import type { IoniconName } from './types';

type InputFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  icon?: IoniconName;
  hint?: string;
  required?: boolean;
  multiline?: boolean;
  error?: string;
  /** Bilang lang ang papasok — sinasala sa mismong pagpindot. */
  digitsOnly?: boolean;
  maxLength?: number;
  /** Hindi kayang baguhin — para sa mga kinakalkulang halaga tulad ng edad. */
  readOnly?: boolean;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'style' | 'multiline' | 'maxLength'>;

/**
 * Pangkalahatang text input ng mga registration form. Hiwalay sa `TextField`
 * ng login dahil kailangan dito ng hint, required marker at multiline.
 */
export function InputField({
  label,
  value,
  onChangeText,
  icon,
  hint,
  required,
  multiline = false,
  error,
  digitsOnly = false,
  maxLength,
  readOnly = false,
  ...inputProps
}: InputFieldProps) {
  const [focused, setFocused] = useState(false);

  // Hinaharang ang mga di-numerong karakter bago pa man mapunta sa state.
  // Mas mabuti itong hindi lumabas kaysa lumabas at saka pagsabihan.
  const handleChange = (text: string) => {
    const filtered = digitsOnly ? text.replace(/\D/g, '') : text;

    onChangeText(maxLength ? filtered.slice(0, maxLength) : filtered);
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.asterisk}> *</Text>}
      </Text>

      <View
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
          readOnly && styles.fieldReadOnly,
        ]}>
        {!!icon && (
          <Ionicons
            name={icon}
            size={20}
            color={error ? Colors.danger : focused ? Colors.primary : Colors.muted}
            style={multiline ? styles.iconTop : undefined}
          />
        )}

        <TextInput
          style={[styles.input, multiline && styles.inputMultiline, readOnly && styles.inputReadOnly]}
          value={value}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={Colors.muted}
          multiline={multiline}
          editable={!readOnly}
          maxLength={maxLength}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...inputProps}
        />
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}
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
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  fieldMultiline: {
    alignItems: 'flex-start',
    paddingVertical: Spacing.md,
    minHeight: 96,
  },
  fieldFocused: {
    borderColor: Colors.primary,
  },
  fieldError: {
    borderColor: Colors.danger,
  },
  fieldReadOnly: {
    backgroundColor: Colors.background,
    borderColor: Colors.divider,
  },
  inputReadOnly: {
    color: Colors.textSecondary,
  },
  error: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    color: Colors.danger,
  },
  iconTop: {
    marginTop: 2,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: 0,
  },
  inputMultiline: {
    minHeight: 72,
  },
  hint: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
});
