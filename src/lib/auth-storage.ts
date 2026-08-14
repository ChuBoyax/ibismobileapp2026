import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Lahat ng sensitibong datos ay dumadaan dito. Ginagamit ang expo-secure-store
 * na naka-encrypt na sa antas ng OS (Android Keystore / iOS Keychain).
 *
 * Ang PIN ay hindi itinatago nang buo — SHA-256 hash lang kasama ang random
 * na salt, kaya walang mababasang PIN kahit may makakuha ng laman ng storage.
 */

const KEY_PIN_HASH = 'ibis.pin.hash';
const KEY_PIN_SALT = 'ibis.pin.salt';
const KEY_BIOMETRIC = 'ibis.biometric.enabled';
const KEY_EMAIL = 'ibis.user.email';
const KEY_ATTEMPTS = 'ibis.pin.attempts';

/** Ilang beses pwedeng magkamali bago mabura ang PIN. */
export const MAX_PIN_ATTEMPTS = 5;

/** Haba ng PIN. Ginagamit din ito ng lock screen at ng setup screen. */
export const PIN_LENGTH = 6;

async function hashPin(pin: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function hasPin() {
  const hash = await SecureStore.getItemAsync(KEY_PIN_HASH);
  return hash !== null;
}

export async function savePin(pin: string) {
  // Bagong salt kada set ng PIN, kaya magkaiba ang hash kahit pareho ang PIN.
  const salt = Crypto.randomUUID();
  const hash = await hashPin(pin, salt);

  await SecureStore.setItemAsync(KEY_PIN_SALT, salt);
  await SecureStore.setItemAsync(KEY_PIN_HASH, hash);
  await resetAttempts();
}

export async function verifyPin(pin: string) {
  const [salt, hash] = await Promise.all([
    SecureStore.getItemAsync(KEY_PIN_SALT),
    SecureStore.getItemAsync(KEY_PIN_HASH),
  ]);

  if (!salt || !hash) return false;
  return (await hashPin(pin, salt)) === hash;
}

export async function getAttempts() {
  const raw = await SecureStore.getItemAsync(KEY_ATTEMPTS);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function setAttempts(count: number) {
  await SecureStore.setItemAsync(KEY_ATTEMPTS, String(count));
}

export async function resetAttempts() {
  await SecureStore.setItemAsync(KEY_ATTEMPTS, '0');
}

export async function isBiometricEnabled() {
  return (await SecureStore.getItemAsync(KEY_BIOMETRIC)) === '1';
}

export async function setBiometricEnabled(enabled: boolean) {
  await SecureStore.setItemAsync(KEY_BIOMETRIC, enabled ? '1' : '0');
}

export async function getSavedEmail() {
  return SecureStore.getItemAsync(KEY_EMAIL);
}

export async function saveEmail(email: string) {
  await SecureStore.setItemAsync(KEY_EMAIL, email);
}

/** Buong sign-out — binubura ang PIN, biometric setting at naka-save na email. */
export async function clearSecurity() {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_PIN_HASH),
    SecureStore.deleteItemAsync(KEY_PIN_SALT),
    SecureStore.deleteItemAsync(KEY_BIOMETRIC),
    SecureStore.deleteItemAsync(KEY_EMAIL),
    SecureStore.deleteItemAsync(KEY_ATTEMPTS),
  ]);
}
