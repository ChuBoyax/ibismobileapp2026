import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    // Kailangan ito sa pinakalabas para gumana ang mga galaw na hawak ng
    // gesture handler, kasama na ang pag-swipe pabalik.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            // Pumapasok ang mga screen mula sa gilid at kayang i-swipe pabalik,
            // kaya may pakiramdam ng lalim ang paglipat imbes na biglaang palit.
            animation: 'slide_from_right',
            gestureEnabled: true,
          }}>
          {/* Mula sa ibaba ang mga registration form — nagpapahiwatig na
              pansamantalang gawain sila at hindi bagong lalim sa nabigasyon. */}
          <Stack.Screen
            name="registration/resident"
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="registration/household"
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="registration/family"
            options={{ animation: 'slide_from_bottom' }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
