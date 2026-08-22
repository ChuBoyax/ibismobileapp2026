import { router } from 'expo-router';

import { ApiError } from '@/lib/api';
import { clearSession, getSavedEmail, isOfflineSession } from '@/lib/auth-storage';
import { clearCache } from '@/lib/db';
import { clearOutbox } from '@/lib/outbox';
import { clearHistory } from '@/lib/sync-history';


export async function endSession(): Promise<void> {
  await clearSession();
}

export async function switchUser(email: string): Promise<void> {
  const previous = (await getSavedEmail())?.trim().toLowerCase();
  const next = email.trim().toLowerCase();

  if (!previous || previous === next) return;

  await Promise.all([clearCache(), clearOutbox(), clearHistory()]);
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

  if (await isOfflineSession()) {
    return true;
  }

  await endSession();
  router.replace('/login');

  return true;
}
