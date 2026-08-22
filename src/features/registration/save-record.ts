import {
  ApiError,
  createFamily,
  createHousehold,
  createResident,
  payloadHasFiles,
  serverReachable,
  updateFamily,
  updateHousehold,
  updateResident,
} from '@/lib/api';
import { isDeviceOnline } from '@/lib/connectivity';
import { putCache, recordCacheKey } from '@/lib/db';
import { referencedUuids, resolveRefs } from '@/lib/local-refs';
import { enqueue, outboxUuids, type OutboxType } from '@/lib/outbox';
import { drain, refresh } from '@/lib/sync';



const CREATE = {
  resident: createResident,
  household: createHousehold,
  family: createFamily,
} as const;

const UPDATE = {
  resident: updateResident,
  household: updateHousehold,
  family: updateFamily,
} as const;

export type SaveResult =
 
  | { queued: false }
 
  | { queued: true; reason: string };

export type SaveInput = {
  type: OutboxType;
  uuid: string;
  label?: string | null;
  payload: Record<string, unknown>;
  formValues: Record<string, unknown>;
  
  recordId?: number | null;
  
  expectedUpdatedAt?: string | null;
};

export async function saveRecord(input: SaveInput): Promise<SaveResult> {
 
  if (!(await isDeviceOnline())) {
    await queue(input, 'No internet connection.');
    return { queued: true, reason: 'No internet connection.' };
  }

  
  if (payloadHasFiles(input.payload) && !(await serverReachable())) {
    await queue(input, 'The server did not respond.');
    return { queued: true, reason: 'The server did not respond.' };
  }

 
  const resolved = await resolveReferences(input.payload);

  if (!resolved.ready) {
    const reason =
      'missing' in resolved
        ? 'This points to a record that was discarded from the queue.'
        : 'Waiting for the household or family it belongs to.';

    await queue(input, reason);

   
    void drain();

    return { queued: true, reason };
  }

  try {
    if (input.recordId) {
      const { data } = await UPDATE[input.type](input.recordId, {
        ...resolved.payload,
        ...(input.expectedUpdatedAt ? { expected_updated_at: input.expectedUpdatedAt } : {}),
      });

     
      void putCache(recordCacheKey(input.type, input.recordId), data);
    } else {
      await CREATE[input.type]({ ...resolved.payload, uuid: input.uuid });
    }

    return { queued: false };
  } catch (error) {
    const status = error instanceof ApiError ? error.status : -1;

   
    if (status === 422 || status === 413) throw error;

   
    if (status === 409) throw error;

   
    if (status === 401) throw error;

    
    await queue(input, error instanceof Error ? error.message : 'Could not send the record.');

   
    void drain();

    return {
      queued: true,
      reason: error instanceof Error ? error.message : 'Could not send the record.',
    };
  }
}

async function resolveReferences(payload: Record<string, unknown>) {
  if (referencedUuids(payload).length === 0) {
    return { ready: true, payload } as const;
  }

  const queued = await outboxUuids();

  return resolveRefs(payload, (uuid) => queued.has(uuid));
}

async function queue(input: SaveInput, reason?: string) {
  await enqueue({
    uuid: input.uuid,
    type: input.type,
    label: input.label ?? null,
    payload: { ...input.payload, uuid: input.uuid },
    formValues: input.formValues,
    recordId: input.recordId ?? null,
    expectedUpdatedAt: input.expectedUpdatedAt ?? null,
    reason,
  });


  await refresh();
}
