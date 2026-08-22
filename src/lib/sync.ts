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
import { rememberId, resolveRefs } from '@/lib/local-refs';
import { recordSynced } from '@/lib/sync-history';
import { warmOfflineData } from '@/lib/warm-offline-data';
import {
  counts,
  missingPhotos,
  outboxUuids,
  pending,
  remove,
  setStatus,
  type OutboxCounts,
  type OutboxItem,
  type OutboxType,
} from '@/lib/outbox';

const CREATE: Record<
  OutboxType,
  (
    payload: Record<string, unknown>,
    options?: { timeout?: number }
  ) => Promise<{ data: { id: number } }>
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


const SYNC_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 8;

const CONCURRENCY = 3;

const FIRST_RETRY_MS = 15_000;
const MAX_RETRY_MS = 5 * 60_000;

type Listener = (state: SyncState) => void;

export type SyncState = {
  running: boolean;
  counts: OutboxCounts;
 
  justSynced: number;
  lastSyncAt: Date | null;
};

let running = false;
let listeners: Listener[] = [];
let lastCounts: OutboxCounts = { pending: 0, syncing: 0, needsFix: 0, conflicts: 0, total: 0 };

let justSynced = 0;
let lastSyncAt: Date | null = null;

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = FIRST_RETRY_MS;

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


const KEEP_AWAKE_TAG = 'ibis-sync';

let screenHeld = false;

async function holdScreenAwake(hold: boolean) {

  const wanted = hold && AppState.currentState === 'active';

  if (wanted === screenHeld) return;

  try {
    if (wanted) await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    else await deactivateKeepAwake(KEEP_AWAKE_TAG);

    screenHeld = wanted;
  } catch {
   
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.push(listener);
  listener({ running, counts: lastCounts, justSynced, lastSyncAt });

  return () => {
    listeners = listeners.filter((item) => item !== listener);
  };
}
const PUBLISH_INTERVAL_MS = 400;

let publishTimer: ReturnType<typeof setTimeout> | null = null;
let publishQueued = false;
let publishSeq = 0;

async function emit() {
  const seq = ++publishSeq;
  const next = await counts();

  if (seq < publishSeq) return;

  lastCounts = next;
  listeners.forEach((listener) =>
    listener({ running, counts: lastCounts, justSynced, lastSyncAt })
  );
}

function publish() {
  if (publishTimer) {
    publishQueued = true;
    return;
  }
  void emit().catch(() => {});

  publishTimer = setTimeout(() => {
    publishTimer = null;

    if (publishQueued) {
      publishQueued = false;
      publish();
    }
  }, PUBLISH_INTERVAL_MS);
}
async function publishNow() {
  if (publishTimer) clearTimeout(publishTimer);

  publishTimer = null;
  publishQueued = false;

  await emit();
}

export async function refresh() {
  await publishNow();
}

type Outcome =
 
  | 'settled'
 
  | 'deferred'
  
  | 'auth'
 
  | 'unreachable';


async function send(
  item: OutboxItem,
  
  queued: (uuid: string) => boolean
): Promise<Outcome> {
  if (item.attempts >= MAX_ATTEMPTS) {
    await setStatus(
      item.uuid,
      'needs_fix',
      { error: 'Could not reach the server after several tries. Tap Retry to try again.' }
    );
    return 'settled';
  }

 
  const missing = missingPhotos(item.payload);

  if (missing.length > 0) {
    await setStatus(item.uuid, 'needs_fix', {
      error:
        `The photo is no longer on this device (${missing.length} file` +
        `${missing.length === 1 ? '' : 's'} missing). Tap Fix to attach it again.`,
    });
    return 'settled';
  }

 
  const resolution = await resolveRefs(item.payload, queued);

  if (!resolution.ready) {
    if ('missing' in resolution) {
     
      await setStatus(item.uuid, 'needs_fix', {
        error:
          'This record points to a household or family that was discarded from the queue. ' +
          'Tap Fix to choose another one.',
      });

      return 'settled';
    }

    await setStatus(item.uuid, 'pending', {
      error: 'Waiting for the household or family it belongs to.',
    });

    return 'deferred';
  }

  const payload = resolution.payload;

  await setStatus(item.uuid, 'syncing');
  publish();

  try {
    if (item.recordId) {
      await UPDATE[item.type](
        item.recordId,
        item.expectedUpdatedAt
          ? { ...payload, expected_updated_at: item.expectedUpdatedAt }
          : payload,
        { timeout: SYNC_TIMEOUT_MS }
      );
    } else {
      const created = await CREATE[item.type](payload, { timeout: SYNC_TIMEOUT_MS });
      await rememberId(item.uuid, item.type, created.data.id);
    }

    await recordSynced({
      uuid: item.uuid,
      type: item.type,
      label: item.label,
      action: item.recordId ? 'updated' : 'created',
      recordId: item.recordId,
    });

    await remove(item.uuid);

    justSynced += 1;
    lastSyncAt = new Date();
    retryDelay = FIRST_RETRY_MS;

    return 'settled';
  } catch (error) {
    const status = error instanceof ApiError ? error.status : -1;
    const friendly = error instanceof Error ? error.message : 'Sync failed.';
    const raw = error instanceof ApiError ? error.detail : undefined;
    const message = raw && raw !== friendly ? `${friendly} (${raw})` : friendly;

    if (status === 401) {
      await setStatus(item.uuid, 'pending', { error: message });
      return 'auth';
    }

    if (status === 409) {
      await setStatus(item.uuid, 'conflict', { error: message });
      return 'settled';
    }

    if (status === 422 || status === 413) {
      await setStatus(item.uuid, 'needs_fix', { error: message, countAttempt: true });
      return 'settled';
    }

    await setStatus(item.uuid, 'pending', { error: message, countAttempt: true });
    return status === 0 ? 'unreachable' : 'settled';
  }
}

export async function drain(): Promise<void> {
  if (running) return;

  running = true;
  justSynced = 0;
  await publishNow();

  try {
    if (!(await isDeviceOnline())) return;

    const items = await pending();
    await holdScreenAwake(items.length > 0);
    let halt: 'auth' | 'unreachable' | null = null;

    const known = await outboxUuids();
    const queued = (uuid: string) => known.has(uuid);

    let wave = items;

    while (wave.length > 0 && !halt) {
      const waiting: OutboxItem[] = [];
      let next = 0;

      const worker = async () => {
        while (!halt) {
          const item = wave[next++];

          if (!item) return;

          const outcome = await send(item, queued);

          if (outcome === 'deferred') waiting.push(item);
          else if (outcome !== 'settled') halt = outcome;
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, wave.length) }, () => worker())
      );

      if (waiting.length === wave.length) break;

      wave = waiting;
    }

    if (halt === 'auth') pausedForAuth = true;
  } finally {
    running = false;
    await holdScreenAwake(false);
    await publishNow();

    const remaining = await pending();

    if (remaining.length > 0) scheduleRetry();
    else cancelRetry();
  }
}

export function resumeSync() {
  pausedForAuth = false;
  cancelRetry();
  void drain();
}

export function startSync(): () => void {
  let wasOnline: boolean | null = null;

  const subscription = Network.addNetworkStateListener((state) => {
    const isOnline = !!state.isConnected && state.isInternetReachable !== false;

    if (isOnline && wasOnline === false) {
      pausedForAuth = false;
      cancelRetry();
      void drain();
      void warmOfflineData().catch(() => {});
    }

    wasOnline = isOnline;
  });
  const appState = AppState.addEventListener('change', (next) => {
    if (next === 'active') {
      pausedForAuth = false;
      cancelRetry();
      void drain();
      return;
    }

    void holdScreenAwake(false);
  });
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
