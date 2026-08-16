import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SelectOption } from '@/constants/form-options';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type SegmentedFieldProps = {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  hint?: string;
  required?: boolean;
  error?: string;
};

/**
 * Para sa maiikling pagpipilian (Male/Female, Oo/Hindi). Nakalantad lahat ng
 * pagpipilian kaya isang tap lang — mas mabilis kaysa dropdown kapag statik at
 * kakaunti ang laman.
 */
export function SegmentedField({
  label,
  value,
  onChange,
  options,
  hint,
  required,
  error,
}: SegmentedFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.asterisk}> *</Text>}
      </Text>

      <View style={styles.row}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              style={[
                styles.segment,
                active && styles.segmentActive,
                !!error && !active && styles.segmentError,
              ]}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}>
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
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
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  errorText: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    color: Colors.danger,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  segmentError: {
    borderColor: Colors.danger,
  },
  segmentActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  segmentLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  segmentLabelActive: {
    color: Colors.primaryDark,
  },
  hint: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
});
