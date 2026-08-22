import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Network from 'expo-network';
import { AppState } from 'react-native';

import {
  ApiError,
  createFamily,
  createHousehold,
  createResident,
  updateFamily,
  updateHousehold,
  updateResident,
} from '@/lib/api';
import { isDeviceOnline } from '@/lib/connectivity';
import { warmOfflineData } from '@/lib/warm-offline-data';
import {
  counts,
  missingPhotos,
  pending,
  remove,
  setStatus,
  type OutboxCounts,
  type OutboxItem,
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

const UPDATE: Record<
  OutboxType,
  (id: number, payload: Record<string, unknown>, options?: { timeout?: number }) => Promise<unknown>
> = {
  resident: updateResident,
  household: updateHousehold,
  family: updateFamily,
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

/** Ilang tala ang sabay na ipinapadala. Tingnan ang paliwanag sa `drain`. */
const CONCURRENCY = 3;

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
let lastCounts: OutboxCounts = { pending: 0, syncing: 0, needsFix: 0, conflicts: 0, total: 0 };

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

/**
 * Hawak sa screen habang may ipinapadala.
 *
 * Iisa ang tatak na ginagamit at itinatala kung hawak na ba — kaya kahit
 * ilang beses tawagin, isang hawak lang ang mabubuo at isang bitaw lang ang
 * kailangan. Kung magkakaiba ang bilang ng hawak at bitaw, mananatiling gising
 * ang screen kahit tapos na ang sync, at ang baterya ang magbabayad.
 */
const KEEP_AWAKE_TAG = 'ibis-sync';

let screenHeld = false;

async function holdScreenAwake(hold: boolean) {
  // Habang nakabukas lang ang app. Sa background, ang pipigilin natin ay ang
  // screen ng ibang ginagawa ng may-ari — hindi natin iyon karapatan.
  const wanted = hold && AppState.currentState === 'active';

  if (wanted === screenHeld) return;

  try {
    if (wanted) await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    else await deactivateKeepAwake(KEEP_AWAKE_TAG);

    screenHeld = wanted;
  } catch {
    // Hindi ito dapat magpabagsak ng sync. Ang tanging bunga ng pagkabigo ay
    // maagang pag-lock ng screen, at may pambawi naman doon: magpapatuloy ang
    // pila sa susunod na pagbukas ng app.
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.push(listener);
  listener({ running, counts: lastCounts });

  return () => {
    listeners = listeners.filter((item) => item !== listener);
  };
}

/**
 * MAY TAKDA ANG DALAS NG PAG-AABISO.
 *
 * Bawat abiso ay nagpapabasa muli ng listahan sa bawat nakikinig. Kapag sampu
 * ang nasa pila, hindi ito mahalaga. Kapag isang daan at mabilis na
 * nagkakasunuran ang mga pagbabago — halimbawa, kapag pawang nawawala ang
 * larawan at agad-agad na tinatabi ang bawat tala — nagiging daan-daang
 * pagbasa ito sa loob ng ilang sandali, at ang screen mismo ang huminto sa
 * pagtugon habang tumatakbo ang sync.
 *
 * Kaya isang abiso lang kada agwat. Ang una ay agad na dumadaan para hindi
 * mukhang tulog ang app, at ang huling kalagayan ay tiyak na naipapaalam sa
 * bandang huli sa pamamagitan ng `publishNow`.
 */
const PUBLISH_INTERVAL_MS = 400;

let publishTimer: ReturnType<typeof setTimeout> | null = null;
let publishQueued = false;
/**
 * Sinusundan kung alin ang pinakabagong pagbabasa. Ang bilang ay hinihintay,
 * kaya maaaring maunang matapos ang lumang pagbasa kaysa sa bago — at kung
 * hindi ito babantayan, ang lumang bilang ang mananatili sa screen.
 */
let publishSeq = 0;

async function emit() {
  const seq = ++publishSeq;
  const next = await counts();

  // May mas bagong pagbasa nang naunahan ito — luma na ang hawak nito.
  if (seq < publishSeq) return;

  lastCounts = next;
  listeners.forEach((listener) => listener({ running, counts: lastCounts }));
}

function publish() {
  if (publishTimer) {
    publishQueued = true;
    return;
  }

  // Hindi ito hinihintay, kaya walang tatanggap ng error nito. Ang isang
  // screen na sumasablay sa pagtanggap ng abiso ay hindi dapat makapagpahinto
  // ng pagpapadala — ipinagpapatuloy ang pila kahit may nabigong nakikinig.
  void emit().catch(() => {});

  publishTimer = setTimeout(() => {
    publishTimer = null;

    if (publishQueued) {
      publishQueued = false;
      publish();
    }
  }, PUBLISH_INTERVAL_MS);
}

/** Walang antala at hinihintay — para sa kalagayang dapat tumpak kaagad. */
async function publishNow() {
  if (publishTimer) clearTimeout(publishTimer);

  publishTimer = null;
  publishQueued = false;

  await emit();
}

export async function refresh() {
  await publishNow();
}


/**
 * Ang kalabasan ng isang padala — ito ang nagsasabi kung dapat pang
 * ipagpatuloy ang natitira sa pila.
 */
type Outcome =
  /** Naipadala na o naitabi na para sa tao. Tuloy ang iba. */
  | 'settled'
  /** Nawalan ng bisa ang token — walang saysay ang natitira. */
  | 'auth'
  /** Hindi maabot ang server — walang saysay ang natitira. */
  | 'unreachable';

/** Isang tala: mula sa pagsusuri hanggang sa pagtatala ng kinalabasan. */
async function send(item: OutboxItem): Promise<Outcome> {
  if (item.attempts >= MAX_ATTEMPTS) {
    await setStatus(
      item.uuid,
      'needs_fix',
      { error: 'Could not reach the server after several tries. Tap Retry to try again.' }
    );
    return 'settled';
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
    return 'settled';
  }

  await setStatus(item.uuid, 'syncing');
  publish();

  try {
    if (item.recordId) {
      // Pagbabago ng umiiral nang tala. Kasama ang bersyon nang huli
      // itong buksan, kaya masasabi ng server kung may ibang nakaunang
      // magpalit habang wala tayong signal.
      await UPDATE[item.type](
        item.recordId,
        item.expectedUpdatedAt
          ? { ...item.payload, expected_updated_at: item.expectedUpdatedAt }
          : item.payload,
        { timeout: SYNC_TIMEOUT_MS }
      );
    } else {
      await CREATE[item.type](item.payload, { timeout: SYNC_TIMEOUT_MS });
    }

    // Tagumpay — kasama ang kaso ng "naipadala na dati", dahil 200 rin
    // ang isinasagot ng server doon.
    await remove(item.uuid);

    // Gumagana pala ang koneksyon — ibalik sa maikling pagitan para
    // mabilis maabot ang natitira.
    retryDelay = FIRST_RETRY_MS;

    return 'settled';
  } catch (error) {
    const status = error instanceof ApiError ? error.status : -1;
    // Ang Sync queue ang tanging lugar kung saan kapaki-pakinabang ang
    // teknikal na detalye — dito pumupunta ang naghahanap ng dahilan.
    // Sa ibang screen, ang malinis na mensahe lang ang lumalabas.
    const friendly = error instanceof Error ? error.message : 'Sync failed.';
    const raw = error instanceof ApiError ? error.detail : undefined;
    const message = raw && raw !== friendly ? `${friendly} (${raw})` : friendly;

    if (status === 401) {
      // Wala nang bisa ang token. Walang saysay ipagpatuloy — ibabalik
      // sa pending at hihinto, ipagpapatuloy pagkatapos mag-login.
      await setStatus(item.uuid, 'pending', { error: message });
      return 'auth';
    }

    if (status === 409) {
      // May ibang nagpalit ng parehong tala. Hindi ito kayang pagpasiyahan
      // ng app: ang dalawang bersyon ay parehong sinadya ng tao. Kaya
      // hinihinto ito at inilalagay sa Sync queue, kung saan pipili ang
      // gumagamit kung alin ang mananaig. Hindi ito bumibilang bilang
      // subok — hindi naman ito maaayos ng pag-uulit.
      await setStatus(item.uuid, 'conflict', { error: message });
      return 'settled';
    }

    if (status === 422 || status === 413) {
      // Hindi maaayos ng pag-uulit — kailangan ng tao.
      await setStatus(item.uuid, 'needs_fix', { error: message, countAttempt: true });
      return 'settled';
    }

    // Pansamantala: walang signal (0) o problema sa server (5xx).
    await setStatus(item.uuid, 'pending', { error: message, countAttempt: true });

    // Kung hindi maabot ang server, walang saysay ipagpatuloy ang iba.
    return status === 0 ? 'unreachable' : 'settled';
  }
}

/**
 * Ipinapadala ang lahat ng naghihintay. Ligtas tawagin kahit kailan —
 * kung may tumatakbo nang drain, agad itong babalik.
 */
export async function drain(): Promise<void> {
  if (running) return;

  running = true;
  await publishNow();

  try {
    if (!(await isDeviceOnline())) return;

    const items = await pending();

    // Pinipigilang matulog ang screen habang may ipinapadala.
    //
    // Nasa JavaScript thread lang ang pagpapadala — kapag na-lock ang
    // telepono, hihinto ang JavaScript at kasama nito ang pila. Sa sampung
    // tala, tapos na bago pa maabot ang lock. Sa isang daang tala, ibinababa
    // ng enumerator ang telepono, nagla-lock ito pagkalipas ng kalahating
    // minuto, at ang matatagpuan niya mamaya ay pilang tumigil sa ikawalo.
    //
    // Ang pagpigil ay habang nakabukas lang ang app. Kapag nasa background ito,
    // hindi natin dapat pigilin ang screen ng ibang ginagawa ng may-ari.
    await holdScreenAwake(items.length > 0);

    /** Susunod na kukunin ng sinumang manggagawang bakante. */
    let next = 0;
    /** Kapag may nakitang dahilan para ihinto lahat, dito ito nakasulat. */
    let halt: 'auth' | 'unreachable' | null = null;

    /*
      MAGKAKASABAY NA PADALA.

      Ang isa-isang padala ay halos puro paghihintay: bawat tala ay may sariling
      handshake, paghihintay sa server, at pagsagot. Habang naghihintay ang isa,
      walang ginagawa ang koneksyon — at sa isang daang tala, ang mga
      paghihintay na iyon ang bumubuo sa kalakhan ng oras, hindi ang mismong
      paglipat ng datos.

      Tatlo lang at hindi mas marami. Ang layunin ay punan ang mga puwang ng
      paghihintay, hindi ang barahin ang uplink: kapag sabay-sabay na masyado,
      pinagkakaagawan ng bawat upload ang parehong makitid na bandwidth at
      nauuwi sa timeout ang lahat nang sabay — mas mabagal pa kaysa sa isa-isa.

      Walang pagkakasunod na sinisira nito. Ang mga tala sa pila ay hindi
      tumutukoy sa isa't isa: ang mapipili lang na sambahayan o pamilya ay ang
      nasa server na, kaya walang naghihintay ng ibang tala bago maipadala.
    */
    async function worker() {
      while (!halt) {
        const item = items[next++];

        if (!item) return;

        const outcome = await send(item);

        if (outcome !== 'settled') halt = outcome;
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker())
    );

    // Hihinto ang kusang pag-uulit hanggang may bagong login. Itinatakda ito
    // dito at hindi sa loob ng `send`, para iisa ang lugar na nagpapasiya.
    if (halt === 'auth') pausedForAuth = true;
  } finally {
    running = false;
    await holdScreenAwake(false);
    await publishNow();

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

      // Ginagamit din ang sandaling ito para punan ang cache.
      //
      // Ang pag-init ay tumatakbo lang dati kapag nag-login. Ang taong
      // naka-login na nang matagal ay hindi kailanman nakakakuha ng bagong
      // laman hangga't hindi niya binubuksan ang bawat screen — kaya blangko
      // siya sa lugar na walang signal kahit araw-araw namang dumadaan sa
      // WiFi. Ang pagbabalik ng koneksyon ang tamang sandali: alam nating
      // may signal, at hindi naghihintay ang user.
      void warmOfflineData().catch(() => {});
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
      return;
    }

    // Umalis sa app habang nagpapadala. Binibitawan ang screen — hindi tayo
    // ang dapat magpasiya kung gising ang telepono kapag wala na tayo sa harap.
    void holdScreenAwake(false);
  });

  // Isang beses sa pagsisimula ng app.
  //
  // Kailangan ito: kung nag-reconnect ang cellphone habang SARADO ang app,
  // walang transition na mangyayari pagbukas mo — mananatiling hindi
  // naipapadala ang pila hanggang mag-toggle ka ng WiFi.
  void (async () => {
    wasOnline = await isDeviceOnline();
    await publishNow();
    if (wasOnline) void drain();
  })();

  return () => {
    subscription.remove();
    appState.remove();
    cancelRetry();
    void holdScreenAwake(false);
  };
}
