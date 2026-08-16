import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type ToggleFieldProps = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
};

/**
 * Pang-oo/hindi na tanong tulad ng PWD, Senior Citizen o 4Ps. Buong hilera ang
 * pinindot, hindi lang ang maliit na switch, para madaling matamaan ng hinlalaki.
 */
export function ToggleField({ label, value, onChange, hint }: ToggleFieldProps) {
  return (
    <Pressable
      style={[styles.row, value && styles.rowActive]}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {!!hint && <Text style={styles.hint}>{hint}</Text>}
      </View>

      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor={Colors.surface}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    minHeight: 56,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  rowActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  text: {
    flex: 1,
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  hint: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
});
