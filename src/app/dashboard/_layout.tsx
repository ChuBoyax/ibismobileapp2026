import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Anim na tab. May outline na icon kapag hindi aktibo at solid kapag aktibo —
 * ito ang nagbibigay ng malinaw na indikasyon kahit maliit ang mga label.
 */
const TABS: { name: string; title: string; icon: IoniconName; active: IoniconName }[] = [
  { name: 'index', title: 'Dashboard', icon: 'grid-outline', active: 'grid' },
  { name: 'residents', title: 'Residents', icon: 'people-outline', active: 'people' },
  { name: 'families', title: 'Families', icon: 'person-add-outline', active: 'person-add' },
  { name: 'households', title: 'Households', icon: 'home-outline', active: 'home' },
  { name: 'reports', title: 'Reports', icon: 'bar-chart-outline', active: 'bar-chart' },
  { name: 'settings', title: 'Settings', icon: 'settings-outline', active: 'settings' },
];

/** Padding sa magkabilang gilid ng tab bar para hindi dikit sa dulo ang una at huling label. */
const BAR_PADDING = 10;

/**
 * Tantiyang lapad ng label kada font size. Ang pinakamahabang label ay
 * "Households" (10 letra) — humigit-kumulang 5.5x ng font size ang lapad nito.
 */
const LONGEST_LABEL_RATIO = 5.5;

export default function DashboardTabsLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Ang laki ng label ay sinusukat mula sa aktwal na lapad ng screen, kaya
  // kasya ang "Households" sa maliliit na cellphone at lumalaki sa malalaki.
  const tabWidth = (width - BAR_PADDING * 2) / TABS.length;
  const labelSize = Math.max(8, Math.min(11, Math.floor((tabWidth - 6) / LONGEST_LABEL_RATIO)));
  const iconSize = labelSize >= 10 ? 22 : 20;

  // Gesture bar / home indicator. May pinakamababang 12 para hindi dikit sa
  // ilalim kahit sa mga cellphone na walang inset (button navigation).
  const bottomInset = Math.max(insets.bottom, 12);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.muted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.divider,
          height: 58 + bottomInset,
          paddingTop: 10,
          paddingBottom: bottomInset,
          paddingHorizontal: BAR_PADDING,
          // Bahagyang anino pataas para hiwalay ang tab bar sa content.
          shadowColor: '#0A2A18',
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: labelSize,
          fontWeight: '600',
          marginTop: 3,
        },
        tabBarItemStyle: {
          paddingHorizontal: 0,
          borderRadius: Radius.sm,
        },
      }}>
      {TABS.map(({ name, title, icon, active }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? active : icon} size={iconSize} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
