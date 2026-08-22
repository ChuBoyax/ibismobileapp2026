import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricSupport = {
  
  available: boolean;
 
  label: string;
 
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
   
    disableDeviceFallback: true,
  });

  return result.success;
}
