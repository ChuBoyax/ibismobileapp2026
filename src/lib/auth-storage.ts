import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';



const KEY_PIN_HASH = 'ibis.pin.hash';
const KEY_PIN_SALT = 'ibis.pin.salt';
const KEY_BIOMETRIC = 'ibis.biometric.enabled';
const KEY_EMAIL = 'ibis.user.email';
const KEY_ATTEMPTS = 'ibis.pin.attempts';
const KEY_TOKEN = 'ibis.api.token';
const KEY_PROFILE = 'ibis.user.profile';

export const MAX_PIN_ATTEMPTS = 5;


export const PIN_LENGTH = 6;

async function hashPin(pin: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}


const KEY_PASSWORD_HASH = 'ibis.password.hash';
const KEY_PASSWORD_SALT = 'ibis.password.salt';


const PASSWORD_ROUNDS = 1000;

async function hashPassword(password: string, salt: string) {
  let digest = `${salt}:${password}`;

  for (let round = 0; round < PASSWORD_ROUNDS; round++) {
    digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, digest);
  }

  return digest;
}

export async function savePasswordProof(password: string) {
  const salt = Crypto.randomUUID();
  const hash = await hashPassword(password, salt);

  await SecureStore.setItemAsync(KEY_PASSWORD_SALT, salt);
  await SecureStore.setItemAsync(KEY_PASSWORD_HASH, hash);
}

export async function hasPasswordProof() {
  return (await SecureStore.getItemAsync(KEY_PASSWORD_HASH)) !== null;
}

const KEY_OFFLINE_SESSION = 'ibis.session.offline';

export async function setOfflineSession(active: boolean) {
  if (active) {
    await SecureStore.setItemAsync(KEY_OFFLINE_SESSION, '1');
    return;
  }

  await SecureStore.deleteItemAsync(KEY_OFFLINE_SESSION);
}

export async function isOfflineSession() {
  return (await SecureStore.getItemAsync(KEY_OFFLINE_SESSION)) === '1';
}

export async function verifyPassword(password: string) {
  const [salt, hash] = await Promise.all([
    SecureStore.getItemAsync(KEY_PASSWORD_SALT),
    SecureStore.getItemAsync(KEY_PASSWORD_HASH),
  ]);

  if (!salt || !hash) return false;

  return (await hashPassword(password, salt)) === hash;
}

export async function hasPin() {
  const hash = await SecureStore.getItemAsync(KEY_PIN_HASH);
  return hash !== null;
}

export async function savePin(pin: string) {
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



export async function getToken() {
  return SecureStore.getItemAsync(KEY_TOKEN);
}

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(KEY_TOKEN, token);
}


export async function getProfile<T>(): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(KEY_PROFILE);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveProfile(profile: unknown) {
  await SecureStore.setItemAsync(KEY_PROFILE, JSON.stringify(profile));
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_TOKEN),
    SecureStore.deleteItemAsync(KEY_OFFLINE_SESSION),
  ]);
}

export async function clearSecurity() {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_PIN_HASH),
    SecureStore.deleteItemAsync(KEY_PIN_SALT),
    SecureStore.deleteItemAsync(KEY_BIOMETRIC),
    SecureStore.deleteItemAsync(KEY_EMAIL),
    SecureStore.deleteItemAsync(KEY_ATTEMPTS),
    SecureStore.deleteItemAsync(KEY_TOKEN),
    SecureStore.deleteItemAsync(KEY_PROFILE),
    SecureStore.deleteItemAsync(KEY_PASSWORD_HASH),
    SecureStore.deleteItemAsync(KEY_PASSWORD_SALT),
    SecureStore.deleteItemAsync(KEY_OFFLINE_SESSION),
  ]);
}
