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
const KEY_TOKEN = 'ibis.api.token';
const KEY_PROFILE = 'ibis.user.profile';

/** Ilang beses pwedeng magkamali bago mabura ang PIN. */
export const MAX_PIN_ATTEMPTS = 5;

/** Haba ng PIN. Ginagamit din ito ng lock screen at ng setup screen. */
export const PIN_LENGTH = 6;

async function hashPin(pin: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

// ── Offline na login ────────────────────────────────────────────────────

const KEY_PASSWORD_HASH = 'ibis.password.hash';
const KEY_PASSWORD_SALT = 'ibis.password.salt';

/**
 * Ilang beses inuulit ang hash.
 *
 * Ang isang beses na SAHA-256 ay mabilis subukan nang paulit-ulit — kung
 * makuha ng iba ang laman ng storage, milyon-milyong hula kada segundo ang
 * kaya niyang gawin. Sa pag-uulit, ang bawat hula ay nagiging kasing bagal ng
 * isang tunay na login. Hindi ito nagpapahirap sa may-ari (isang beses lang
 * naman), pero libong beses na mas mabagal para sa umaatake.
 */
const PASSWORD_ROUNDS = 1000;

async function hashPassword(password: string, salt: string) {
  let digest = `${salt}:${password}`;

  for (let round = 0; round < PASSWORD_ROUNDS; round++) {
    digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, digest);
  }

  return digest;
}

/**
 * Itinatago ang patunay ng password para sa offline na login.
 *
 * HINDI ITINATAGO ANG MISMONG PASSWORD — hash lang na may sariling salt, at
 * nasa expo-secure-store na naka-encrypt ng Android Keystore / iOS Keychain.
 * Hindi ito maibabalik sa orihinal; ihahambing lang ang bagong hash dito.
 */
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

/**
 * Pumasok ang user gamit ang naka-save na patunay dahil hindi maabot ang server.
 *
 * Kailangan ito dahil walang token ang ganitong pagpasok — imposibleng
 * makakuha ng token nang hindi nakakausap ang server. Ang bandilang ito ang
 * nagsasabing may karapatan siyang makita ang naka-save na datos, kahit walang
 * token. Kapag nakabalik ang koneksyon, tatanggihan ng server ang anumang
 * hiling at doon siya papapasok muli sa tunay na login.
 */
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

/** Tama ba ang password, batay sa huling matagumpay na online na login? */
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

// ── API token at profile ────────────────────────────────────────────────

export async function getToken() {
  return SecureStore.getItemAsync(KEY_TOKEN);
}

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(KEY_TOKEN, token);
}

/**
 * Naka-cache na profile mula sa huling login, para may maipakitang pangalan
 * at barangay ang dashboard kahit hindi pa tapos ang /me request.
 */
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

/**
 * Tinatapos ang session — ang TOKEN lang, hindi ang datos ng user.
 *
 * Sinasadyang NANANATILI ang profile: pag-aari iyon ng taong iyon, at siya
 * rin ang malamang na babalik sa cellphone na ito. Kung buburahin, ang
 * offline na pagpasok ay magiging walang kabuluhan — makakapasok ka nga, pero
 * walang pangalan, walang barangay, walang maipapakita.
 *
 * Ang paglilinis ng datos ay may sariling sandali: kapag ibang tao na ang
 * nag-login, o kapag tuluyan nang inalis ang seguridad sa device.
 */
export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_TOKEN),
    SecureStore.deleteItemAsync(KEY_OFFLINE_SESSION),
  ]);
}

/** Buong sign-out — binubura ang PIN, biometric setting, email, token at profile. */
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
