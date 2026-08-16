import { Slot } from 'expo-router';

import { RequireAuth } from '@/components/require-auth';


export default function RegistrationLayout() {
  return (
    <RequireAuth>
      <Slot />
    </RequireAuth>
  );
}
