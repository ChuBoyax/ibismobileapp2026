import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { ApiError, createFamily, createHousehold, createResident } from '@/lib/api';
import { isDeviceOnline } from '@/lib/connectivity';
import {
  counts,
  missingPhotos,
  pending,
  remove,
  setStatus,
  type OutboxCounts,
  type OutboxType,
} from '@/lib/outbox';

/**
 * Sync engine — inihahatid ang mga naka-queue na tala kapag may koneksyon.
 *
 * ANG PAG-UURI NG PAGKABIGO ANG BUONG PUNTO NITO. Ang paulit-ulit na retry sa
 * lahat ng pagkakamali ay hindi sync engine — pag-aaksaya iyon ng baterya at
 * paraan para tahimik na mawala ang datos. Tatlong uri ang pinagkakaiba dito:
 *
 *   pansamantala  (walang signal, server down) → subukan ulit mamaya
 *   permanente    (maling datos, sobrang laki) → itigil, ipaayos sa tao
 *   auth          (nawalan ng bisa ang token)  → ihinto lahat, maghintay ng login
 *
 * Kung hindi pinaghiwalay ang mga ito, ang talang may maling petsa ay
 * paulit-ulit na susubukan magpakailanman, at ang talang naantala lang ng
 * mahinang signal ay maaaring itapon nang wala sa panahon.
 */

const CREATE: Record<
  OutboxType,
  (payload: Record<string, unknown>, options?: { timeout?: number }) => Promise<unknown>
> = {
  resident: createResident,
  household: createHousehold,
  family: createFamily,
};

/**
 * Mahaba ang hinihintay ng pila — walang nanonood dito.
 *
 * Sa pag-save, mabilis tayong sumusuko para hindi maghintay ang user. Dito,
 * kabaligtaran ang tama: ang layunin ay makarating talaga ang tala, gaano man
 * kabagal ang signal. Kung paiikliin din ito, ang talang may larawan ay
 * mabibigo sa bawat pagsubok at hindi kailanman maipapadala.
 */
const SYNC_TIMEOUT_MS = 120_000;

/** Hanggang ilang subok bago tumigil sa pansamantalang pagkabigo. */
const MAX_ATTEMPTS = 8;

/**
 * Kusang pag-uulit habang may naiwan sa pila.
 *
 * Hindi sapat ang paghihintay ng "pagbalik ng koneksyon": maraming pagkakataon
 * na konektado ka naman pero hindi pa rin maipadala — patay o nagre-restart
 * ang server, mahina ang signal, o may captive portal ang WiFi. Sa mga iyon,
 * walang network transition na mangyayari at mananatiling naghihintay ang pila.
 *
 * Nagsisimula sa maikling pagitan at dumadoble hanggang sa hangganan, kaya
 * mabilis makabawi kapag panandalian lang ang problema, at hindi naman
 * nagsasayang ng baterya kapag matagal. Bumabalik sa maikli kapag may
 * naipadala o kapag may bagong koneksyon.
 */
const FIRST_RETRY_MS = 15_000;
const MAX_RETRY_MS = 5 * 60_000;

type Listener = (state: SyncState) => void;

export type SyncState = {
  running: boolean;
  counts: OutboxCounts;
};

let running = false;
let listeners: Listener[] = [];
let lastCounts: OutboxCounts = { pending: 0, syncing: 0, needsFix: 0, total: 0 };

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = FIRST_RETRY_MS;
/** Nawalan ng bisa ang token — walang saysay mag-ulit hangga't di nakaka-login. */
let pausedForAuth = false;

function scheduleRetry() {
  if (retryTimer || pausedForAuth) return;

  retryTimer = setTimeout(() => {
    retryTimer = null;
    void drain();
  }, retryDelay);

  retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
}

function cancelRetry() {
  if (retryTimer) clearTimeout(retryTimer);

  retryTimer = null;
  retryDelay = FIRST_RETRY_MS;
}

export function subscribe(listener: Listener): () => void {
  listeners.push(listener);
  listener({ running, counts: lastCounts });

  return () => {
    listeners = listeners.filter((item) => item !== listener);
  };
}

async function publish() {
  lastCounts = await counts();
  listeners.forEach((listener) => listener({ running, counts: lastCounts }));
}

export async function refresh() {
  await publish();
}


/**
 * Ipinapadala ang lahat ng naghihintay. Ligtas tawagin kahit kailan —
 * kung may tumatakbo nang drain, agad itong babalik.
 */
export async function drain(): Promise<void> {
  if (running) return;

  running = true;
  await publish();

  try {
    if (!(await isDeviceOnline())) return;

    const items = await pending();

    for (const item of items) {
      if (item.attempts >= MAX_ATTEMPTS) {
        await setStatus(
          item.uuid,
          'needs_fix',
          { error: 'Could not reach the server after several tries. Tap Retry to try again.' }
        );
        continue;
      }

      // Tsek bago ipadala: nariyan pa ba ang larawan?
      //
      // Kapag wala, babagsak ang pagpapadala sa antas ng network at ang
      // ipapakita ay "Cannot reach the server" — na magtutulak sa user na
      // habulin ang signal gayong ang file pala ang nawawala. Wala ring
      // darating na request sa backend, kaya walang makikita sa logs.
      const missing = missingPhotos(item.payload);

      if (missing.length > 0) {
        await setStatus(item.uuid, 'needs_fix', {
          error:
            `The photo is no longer on this device (${missing.length} file` +
            `${missing.length === 1 ? '' : 's'} missing). Tap Fix to attach it again.`,
        });
        continue;
      }

      await setStatus(item.uuid, 'syncing');
      await publish();

      try {
        await CREATE[item.type](item.payload, { timeout: SYNC_TIMEOUT_MS });

        // Tagumpay — kasama ang kaso ng "naipadala na dati", dahil 200 rin
        // ang isinasagot ng server doon.
        await remove(item.uuid);

        // Gumagana pala ang koneksyon — ibalik sa maikling pagitan para
        // mabilis maabot ang natitira.
        retryDelay = FIRST_RETRY_MS;
      } catch (error) {
        const status = error instanceof ApiError ? error.status : -1;
        const message = error instanceof Error ? error.message : 'Sync failed.';

        if (status === 401) {
          // Wala nang bisa ang token. Walang saysay ipagpatuloy — ibabalik
          // sa pending at hihinto, ipagpapatuloy pagkatapos mag-login.
          await setStatus(item.uuid, 'pending', { error: message });
          pausedForAuth = true;
          return;
        }

        if (status === 422 || status === 413) {
          // Hindi maaayos ng pag-uulit — kailangan ng tao.
          await setStatus(item.uuid, 'needs_fix', { error: message, countAttempt: true });
          continue;
        }

        // Pansamantala: walang signal (0) o problema sa server (5xx).
        await setStatus(item.uuid, 'pending', { error: message, countAttempt: true });

        // Kung hindi maabot ang server, walang saysay ipagpatuloy ang iba.
        if (status === 0) return;
      }
    }
  } finally {
    running = false;
    await publish();

    // Kung may naiwan, magtakda ng susunod na subok. Kapag walang natira,
    // patayin ang timer — walang dahilan para gisingin ang app.
    const remaining = await pending();

    if (remaining.length > 0) scheduleRetry();
    else cancelRetry();
  }
}

/** Ipinagpapatuloy ang pila pagkatapos ng bagong login. */
export function resumeSync() {
  pausedForAuth = false;
  cancelRetry();
  void drain();
}

/**
 * Sinisimulan ang pakikinig sa koneksyon. Tinatawag minsan lang, sa root
 * layout ng app.
 */
export function startSync(): () => void {
  let wasOnline: boolean | null = null;

  const subscription = Network.addNetworkStateListener((state) => {
    const isOnline = !!state.isConnected && state.isInternetReachable !== false;

    // Sa sandali lang ng pagbabalik ng koneksyon nagd-drain — hindi sa bawat
    // ingay ng network state.
    if (isOnline && wasOnline === false) {
      pausedForAuth = false;
      cancelRetry();
      void drain();
    }

    wasOnline = isOnline;
  });

  // Pagbalik ng user sa app mula sa background. Ito ang pinaka-madalas na
  // sandali kung kailan may bagong signal na: inilabas ang cellphone, may
  // saklaw na, binuksan ang app. Walang network transition na nangyayari doon
  // kung nanatiling bukas ang WiFi, kaya hindi sapat ang listener sa itaas.
  const appState = AppState.addEventListener('change', (next) => {
    if (next === 'active') {
      pausedForAuth = false;
      cancelRetry();
      void drain();
    }
  });

  // Isang beses sa pagsisimula ng app.
  //
  // Kailangan ito: kung nag-reconnect ang cellphone habang SARADO ang app,
  // walang transition na mangyayari pagbukas mo — mananatiling hindi
  // naipapadala ang pila hanggang mag-toggle ka ng WiFi.
  void (async () => {
    wasOnline = await isDeviceOnline();
    await publish();
    if (wasOnline) void drain();
  })();

  return () => {
    subscription.remove();
    appState.remove();
    cancelRetry();
  };
}
