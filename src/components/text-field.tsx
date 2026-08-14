import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  icon: IoniconName;
  /** Kapag true, may eye toggle sa kanan at nakatago ang teksto. */
  secure?: boolean;
  /** Pulang mensahe sa ilalim ng input. Nagiging pula rin ang border. */
  error?: string;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'secureTextEntry' | 'style'>;

export function TextField({
  label,
  value,
  onChangeText,
  icon,
  secure = false,
  error,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secure);

  const borderColor = error
    ? Colors.danger
    : focused
      ? Colors.primary
      : Colors.border;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.field, { borderColor }]}>
        <Ionicons
          name={icon}
          size={20}
          color={error ? Colors.danger : focused ? Colors.primary : Colors.muted}
        />

        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={hidden}
          placeholderTextColor={Colors.muted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />

        {secure && (
          <Pressable
            onPress={() => setHidden((prev) => !prev)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Ionicons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={Colors.muted}
            />
          </Pressable>
        )}
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}
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
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    height: 52,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: FontSize.md,
    color: Colors.text,
    // Inaalis ang default na padding ng Android para pantay ang teksto sa icon.
    paddingVertical: 0,
  },
  error: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    color: Colors.danger,
  },
});
