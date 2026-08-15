import { router } from 'expo-router';

import { ApiError } from '@/lib/api';
import { clearSession } from '@/lib/auth-storage';
import { clearCache } from '@/lib/db';

/**
 * Tinatapos ang session: token, profile, at lahat ng naka-cache na datos.
 * Hindi kasama ang PIN at fingerprint — nananatili ang mga iyon para hindi
 * na kailangang i-set ulit sa susunod na login.
 *
 * Mahalagang mabura ang cache: hindi dapat makita ng susunod na maglo-log in
 * ang dashboard at abiso ng nauna.
 */
export async function endSession(): Promise<void> {
  await Promise.all([clearSession(), clearCache()]);
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

  await endSession();
  router.replace('/login');

  return true;
}
