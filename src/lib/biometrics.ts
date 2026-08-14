import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricSupport = {
  /** May hardware ba at may naka-enroll na fingerprint/mukha? */
  available: boolean;
  /** Pangalan na ipapakita sa UI: "Fingerprint", "Face ID", o "Biometrics". */
  label: string;
  /** Icon na bagay sa uri ng biometric. */
  icon: 'finger-print' | 'scan';
};

export async function getBiometricSupport(): Promise<BiometricSupport> {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  const hasFace = types.includes(
    LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
  );
  const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

  // Inuuna ang fingerprint sa label dahil ito ang tiyak na gumagana sa Expo Go.
  const label = hasFingerprint ? 'Fingerprint' : hasFace ? 'Face ID' : 'Biometrics';

  return {
    available: hasHardware && isEnrolled,
    label,
    icon: hasFingerprint ? 'finger-print' : 'scan',
  };
}

export async function authenticate(promptMessage: string) {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancel',
    // Gusto natin ng tunay na biometric, hindi ang device passcode.
    disableDeviceFallback: true,
  });

  return result.success;
}
