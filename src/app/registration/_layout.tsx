import { Stack } from 'expo-router';

import { RequireAuth } from '@/components/require-auth';

import { Colors } from '@/constants/theme';

/**
 * Sariling stack ang mga registration screen.
 *
 * DATI AY <Slot /> ITO, at iisang screen lang ang buong registration sa
 * paningin ng router. Sapat iyon noong iisa ang anyo ng bawat form. Pero
 * ngayong may buod bago ang stepper, dalawang screen na ang isang tala:
 *
 *   listahan → buod (?id=5) → stepper (?id=5&edit=1)
 *
 * Sa ilalim ng Slot ay walang mahihimay ang router sa dalawang iyon — iisang
 * ruta lang sila na nagpapalit ng parameter, kaya ang pagpindot ng back mula
 * sa stepper ay lumalagpas sa buod pabalik sa listahan. Sa Stack, bawat push
 * ay tunay na hakbang, kaya ang back ay bumabalik sa buod gaya ng inaasahan.
 */
export default function RegistrationLayout() {
  return (
    <RequireAuth>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
    </RequireAuth>
  );
}
