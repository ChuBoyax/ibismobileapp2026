import { Tabs } from 'expo-router';

import { AnimatedTabBar, TAB_ICONS } from '@/components/animated-tab-bar';
import { RequireAuth } from '@/components/require-auth';

/**
 * Anim na tab na may sariling lumulutang na tab bar.
 *
 * Ang pagguhit ng bar ay nasa AnimatedTabBar na — dito na lang ang pagtatala
 * ng mga screen. Nakapatong ang bar sa ibabaw ng nilalaman, kaya may sariling
 * puwang sa ilalim ang bawat screen (tingnan ang TAB_BAR_CLEARANCE).
 */
export default function DashboardTabsLayout() {
  return (
    <RequireAuth>
      <Tabs
        tabBar={(props) => <AnimatedTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          // Hindi na kailangan ang orihinal na bar — pinapalitan ito ng sarili
          // nating tabBar, pero nananatili ang mga label para sa accessibility.
          tabBarStyle: { display: 'none' },
        }}>
        {Object.entries(TAB_ICONS).map(([name, meta]) => (
          <Tabs.Screen key={name} name={name} options={{ title: meta.label }} />
        ))}
      </Tabs>
    </RequireAuth>
  );
}
