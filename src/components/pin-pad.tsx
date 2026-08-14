import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type PinPadProps = {
  value: string;
  onChange: (next: string) => void;
  length: number;
  /** Kapag totoo, pumupula at umuuga ang mga tuldok. */
  error?: boolean;
  /** Kung may laman, may biometric key sa kaliwa ng zero. */
  biometricIcon?: IoniconName | null;
  onBiometric?: () => void;
  /** Puti ang tuldok at teksto kapag nasa green na background. */
  onDark?: boolean;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinPad({
  value,
  onChange,
  length,
  error = false,
  biometricIcon = null,
  onBiometric,
  onDark = false,
}: PinPadProps) {
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!error) return;

    // Maikling pag-uga pakaliwa-pakanan para ramdam agad na mali.
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0.6, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [error, shake]);

  function press(digit: string) {
    if (value.length >= length) return;
    onChange(value + digit);
  }

  function backspace() {
    onChange(value.slice(0, -1));
  }

  const dotFilled = onDark ? Colors.onPrimary : Colors.primary;
  const dotEmpty = onDark ? 'rgba(255,255,255,0.3)' : Colors.border;
  const keyText = onDark ? Colors.onPrimary : Colors.text;
  const keyBg = onDark ? Colors.onPrimaryFaded : Colors.surface;

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.dotRow,
          { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) }] },
        ]}>
        {Array.from({ length }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor:
                  index < value.length ? (error ? Colors.danger : dotFilled) : 'transparent',
                borderColor: error ? Colors.danger : index < value.length ? dotFilled : dotEmpty,
              },
            ]}
          />
        ))}
      </Animated.View>

      <View style={styles.keypad}>
        {KEYS.map((key) => (
          <Pressable
            key={key}
            style={({ pressed }) => [
              styles.key,
              { backgroundColor: keyBg },
              pressed && styles.keyPressed,
            ]}
            onPress={() => press(key)}
            accessibilityRole="button"
            accessibilityLabel={key}>
            <Text style={[styles.keyText, { color: keyText }]}>{key}</Text>
          </Pressable>
        ))}

        {/* Kaliwa ng zero: biometric kung available, kung wala ay blangko. */}
        {biometricIcon ? (
          <Pressable
            style={({ pressed }) => [
              styles.key,
              { backgroundColor: keyBg },
              pressed && styles.keyPressed,
            ]}
            onPress={onBiometric}
            accessibilityRole="button"
            accessibilityLabel="Use biometrics">
            <Ionicons name={biometricIcon} size={26} color={keyText} />
          </Pressable>
        ) : (
          <View style={styles.key} />
        )}

        <Pressable
          style={({ pressed }) => [
            styles.key,
            { backgroundColor: keyBg },
            pressed && styles.keyPressed,
          ]}
          onPress={() => press('0')}
          accessibilityRole="button"
          accessibilityLabel="0">
          <Text style={[styles.keyText, { color: keyText }]}>0</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
          onPress={backspace}
          accessibilityRole="button"
          accessibilityLabel="Delete">
          <Ionicons name="backspace-outline" size={24} color={keyText} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  dotRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.lg,
    maxWidth: 300,
  },
  key: {
    // Tatlong key kada hilera. Mababang basis para kasya pa rin ang gap.
    flexBasis: '26%',
    aspectRatio: 1,
    maxWidth: 74,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    opacity: 0.55,
  },
  keyText: {
    fontSize: FontSize.xxl,
    fontWeight: '600',
  },
});
