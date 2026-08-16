import { router } from 'expo-router';

import { ApiError } from '@/lib/api';
import { clearSession, getSavedEmail, isOfflineSession } from '@/lib/auth-storage';
import { clearCache } from '@/lib/db';
import { clearOutbox } from '@/lib/outbox';

/**
 * Tinatapos ang session — ang token lang.
 *
 * Hindi kasama ang PIN, fingerprint, profile at naka-save na datos. Lahat
 * iyon ay pag-aari ng taong huling gumamit, at siya rin ang malamang na
 * babalik. Kapag ibang tao na ang nag-login, doon nililinis (switchUser).
 */
export async function endSession(): Promise<void> {
  // Token lang ang tinatapos. Nananatili ang profile at ang naka-save na
  // datos — pag-aari iyon ng taong iyon, at siya rin ang babalik. Kapag ibang
  // tao na ang nag-login, doon lang nililinis (tingnan ang switchUser).
  await clearSession();
}

/**
 * Tinatawag pagkatapos ng matagumpay na ONLINE na login.
 *
 * Kung iba na ang nag-login kaysa sa huling gumamit ng cellphone na ito,
 * nililinis ang lahat ng naiwan ng nauna: hindi dapat makita ng bagong user
 * ang dashboard, ulat, at lalo na ang hindi pa naipapadalang tala ng iba —
 * kung masi-sync iyon gamit ang kanyang token, mali ang pagkakatala.
 */
export async function switchUser(email: string): Promise<void> {
  const previous = (await getSavedEmail())?.trim().toLowerCase();
  const next = email.trim().toLowerCase();

  if (!previous || previous === next) return;

  await Promise.all([clearCache(), clearOutbox()]);
}

/**
 * Kapag tinanggihan ng server ang token (401), wala nang saysay ang lokal na
 * session — binura na ito sa server, nag-expire, o nabago ang account. Wala
 * ring maitutulong ang PIN dito: lokal na kandado lang iyon, hindi
 * patunay ng pagkakakilanlan sa backend.
 *
 * Kaya binubura natin ang token at profile, tapos ibinabalik ang user sa
 * password login. Nananatili ang PIN at fingerprint — hindi na kailangang
 * i-set ulit ang mga iyon pagkatapos mag-login.
 *
 * @returns true kung 401 ito at inasikaso na — huwag nang magpakita ng
 *          karagdagang mensahe ang tumawag.
 */
export async function handleAuthError(error: unknown): Promise<boolean> {
  if (!(error instanceof ApiError) || error.status !== 401) {
    return false;
  }

  // Nasa offline na pagpasok siya: walang token, kaya inaasahan ang 401 sa
  // sandaling bumalik ang koneksyon. HINDI SIYA ITINATAPON PALABAS.
  //
  // Nagtatrabaho ang tao, bumalik ang signal, at bigla siyang mawawala sa
  // ginagawa niya — iyon ang mangyayari kung ibabalik siya sa login dito.
  // Sa halip: nananatili siya sa naka-save na datos, at ang sync pill ang
  // magsasabing kailangan na niyang mag-login para maipadala ang naipon.
  if (await isOfflineSession()) {
    return true;
  }

  await endSession();
  router.replace('/login');

  return true;
}
