import { showFamily, showHousehold, showResident } from '@/lib/api';
import { getCache, putCache, recordCacheKey } from '@/lib/db';
import type { OutboxType } from '@/lib/outbox';

const SHOW = {
  resident: showResident,
  household: showHousehold,
  family: showFamily,
} as const;

const CONCURRENCY = 4;

const running = new Set<string>();

export async function backfillRecords(type: OutboxType, ids: number[]): Promise<void> {
  if (running.has(type) || ids.length === 0) return;

  running.add(type);

  try {
   
    const checks = await Promise.all(
      ids.map(async (id) => ({ id, cached: !!(await getCache(recordCacheKey(type, id))) }))
    );

    const missing = checks.filter((entry) => !entry.cached).map((entry) => entry.id);

    if (missing.length === 0) return;

    let next = 0;

    async function worker() {
      while (next < missing.length) {
        const id = missing[next++];

        try {
          const { data } = await SHOW[type](id);
          await putCache(recordCacheKey(type, id), data);
        } catch {
         
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } finally {
    running.delete(type);
  }
}
