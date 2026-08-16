import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Outline kapag hindi aktibo, solid kapag aktibo — malinaw kahit walang label. */
export const TAB_ICONS: Record<string, { icon: IoniconName; active: IoniconName; label: string }> = {
  index: { icon: 'grid-outline', active: 'grid', label: 'Dashboard' },
  residents: { icon: 'people-outline', active: 'people', label: 'Residents' },
  families: { icon: 'person-add-outline', active: 'person-add', label: 'Families' },
  households: { icon: 'home-outline', active: 'home', label: 'Households' },
  reports: { icon: 'bar-chart-outline', active: 'bar-chart', label: 'Reports' },
  settings: { icon: 'settings-outline', active: 'settings', label: 'Settings' },
};

/** Lapad ng bilog na tinatapakan ng isang icon kapag hindi aktibo. */
const ICON_SLOT = 44;
const LABEL_GAP = 6;
const BAR_PADDING = 6;

/**
 * Taas ng mismong bar. Lumulutang ito sa ibabaw ng nilalaman, kaya ito ang
 * dapat idagdag ng bawat screen sa ilalim nitong padding para may makita pa
 * sa dulo ng listahan sa halip na matabunan.
 */
export const TAB_BAR_HEIGHT = ICON_SLOT + BAR_PADDING * 2;

/**
 * Ang kailangan lang natin sa ibinibigay ng navigator.
 *
 * Inilipat ng expo-router ang react-navigation sa loob ng sarili nitong build
 * simula SDK 56, kaya walang matatag na pampublikong landas ang
 * `BottomTabBarProps`. Ito na lang ang isinusulat natin — nakadepende tayo sa
 * hugis na ginagamit natin, hindi sa kinaroroonan ng deklarasyon nito.
 */
type TabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  navigation: {
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

/**
 * Ang spring ang nagbibigay ng buhay sa paglipat — bahagyang lumalampas bago
 * huminto, kaya parang may bigat ang pill imbes na basta lumitaw.
 */
const SPRING = { damping: 18, stiffness: 190, mass: 0.9 } as const;

/**
 * Lumulutang na pill na tab bar.
 *
 * Icon lang ang nakikita sa mga hindi aktibo; ang aktibo ay lumalawak para
 * ilabas ang label nito. Sa Reanimated tumatakbo ang lahat ng paggalaw, kaya
 * nasa UI thread ito at hindi humihinto kahit abala ang JS sa pagkuha ng datos.
 */
export function AnimatedTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Kapag masikip ang screen, mas mabuting walang label kaysa pinipilit na
  // pill na tumatabon sa katabing icon.
  const available = width - Spacing.lg * 2 - BAR_PADDING * 2;
  const labelBudget = available - state.routes.length * ICON_SLOT;
  const showLabel = labelBudget > 48;

  return (
    <View
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}
      pointerEvents="box-none">
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const meta = TAB_ICONS[route.name];

          if (!meta) return null;

          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TabItem
              key={route.key}
              meta={meta}
              focused={focused}
              showLabel={showLabel}
              labelBudget={labelBudget}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({
  meta,
  focused,
  showLabel,
  labelBudget,
  onPress,
}: {
  meta: { icon: IoniconName; active: IoniconName; label: string };
  focused: boolean;
  showLabel: boolean;
  labelBudget: number;
  onPress: () => void;
}) {
  const progress = useSharedValue(focused ? 1 : 0);
  const pressed = useSharedValue(0);

  // Sinusukat muna ang teksto sa labas ng nakikitang bahagi. Hindi puwedeng
  // sukatin sa loob ng pill dahil naka-clip iyon habang tinitipid ang lapad.
  const [labelWidth, setLabelWidth] = useState(0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, SPRING);
  }, [focused, progress]);

  const expansion = showLabel ? Math.min(labelWidth, labelBudget) : 0;

  const pillStyle = useAnimatedStyle(() => ({
    width: ICON_SLOT + (expansion + LABEL_GAP) * progress.value,
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(255,255,255,0)', Colors.onPrimaryFaded]
    ),
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.92]) }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    // Bahagyang dumudulas palabas mula sa likod ng icon sa halip na biglang
    // sumulpot — ito ang nagpapadama na iisang galaw lang ang lahat.
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-10, 0]) }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.08]) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 140 });
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={meta.label}>
      {/* Panukat lang — hindi ito nakikita. */}
      <Text style={[styles.label, styles.measure]} onLayout={(e) => setLabelWidth(e.nativeEvent.layout.width)}>
        {meta.label}
      </Text>

      <Animated.View style={[styles.pill, pillStyle]}>
        <Animated.View style={iconStyle}>
          <Ionicons
            name={focused ? meta.active : meta.icon}
            size={21}
            color={focused ? Colors.onPrimary : 'rgba(255,255,255,0.62)'}
          />
        </Animated.View>

        {showLabel && (
          <Animated.Text style={[styles.label, styles.labelActive, labelStyle]} numberOfLines={1}>
            {meta.label}
          </Animated.Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: BAR_PADDING,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryDeep,
    ...Shadow.raised,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LABEL_GAP,
    height: ICON_SLOT,
    borderRadius: Radius.pill,
    paddingHorizontal: (ICON_SLOT - 21) / 2,
    // Ang label ay naroon na bago pa lumawak ang pill, kaya kailangang
    // putulin ito hanggang may puwang na siyang kasya.
    overflow: 'hidden',
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
  labelActive: {
    // Pinipigilan ang teksto na pumiga habang makitid pa ang pill.
    flexShrink: 0,
  },
  measure: {
    position: 'absolute',
    opacity: 0,
    left: -9999,
    top: 0,
  },
});
