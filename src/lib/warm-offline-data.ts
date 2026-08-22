import {
  dashboard,
  fetchOptions,
  listFamilies,
  listFamiliesFull,
  listHouseholds,
  listHouseholdsFull,
  listResidents,
  listResidentsFull,
  notifications,
  reports,
  type FullListPage,
} from '@/lib/api';
import { backfillRecords } from '@/features/registration/backfill-records';
import { CacheKey, putCache, recordCacheKey, reportCacheKey } from '@/lib/db';
import type { OutboxType } from '@/lib/outbox';

export async function warmOfflineData(): Promise<void> {
  await Promise.allSettled([warmScreens(), warmReports(), warmForms()]);
}

async function warmScreens(): Promise<void> {
  const tasks: [string, Promise<unknown>][] = [
    [CacheKey.dashboard, dashboard()],
    [CacheKey.notifications, notifications().then((result) => result.notifications)],
    [CacheKey.listResidents, warmList('resident', listResidentsFull({ perPage: 50 }))],
    [CacheKey.listFamilies, warmList('family', listFamiliesFull({ perPage: 50 }))],
    [CacheKey.listHouseholds, warmList('household', listHouseholdsFull({ perPage: 50 }))],
  ];

  const results = await Promise.allSettled(tasks.map(([, task]) => task));

  await Promise.all(
    results.map((result, index) =>
      result.status === 'fulfilled' ? putCache(tasks[index][0], result.value) : Promise.resolve()
    )
  );
}
async function warmList<T>(type: OutboxType, request: Promise<FullListPage<T>>) {
  const page = await request;

  if (page.records) {
    await Promise.all(
      page.records.map((record) =>
        typeof record.id === 'number'
          ? putCache(recordCacheKey(type, record.id), record)
          : Promise.resolve()
      )
    );

    return toList(page);
  }

  const ids = page.data
    .map((item) => (item as { id?: unknown }).id)
    .filter((value): value is number => typeof value === 'number');

  await backfillRecords(type, ids);

  return toList(page);
}
async function warmForms(): Promise<void> {
  const tasks: [string, Promise<unknown>][] = [
    [CacheKey.formOptions, fetchOptions().then((result) => result.options)],
    [
      CacheKey.formHouseholds,
      listHouseholds({ perPage: PICKER_PAGE_SIZE }).then((page) =>
        page.data.map((item) => ({
          value: String(item.id),
          label: item.house_number ?? `Household #${item.id}`,
        }))
      ),
    ],
    [
      CacheKey.formFamilies,
      listFamilies({ perPage: PICKER_PAGE_SIZE }).then((page) =>
        page.data.map((item) => ({
          value: String(item.id),
          label: item.family_name ?? `Family #${item.id}`,
        }))
      ),
    ],
    [
      CacheKey.formResidents,
      listResidents({ perPage: PICKER_PAGE_SIZE }).then((page) =>
        page.data.map((item) => ({ value: String(item.id), label: item.full_name }))
      ),
    ],
  ];

  const results = await Promise.allSettled(tasks.map(([, task]) => task));

  await Promise.all(
    results.map((result, index) =>
      result.status === 'fulfilled' ? putCache(tasks[index][0], result.value) : Promise.resolve()
    )
  );
}
const PICKER_PAGE_SIZE = 100;
async function warmReports(): Promise<void> {
  const all = await reports();
  await putCache(reportCacheKey({}), all);

  const perPurok = await Promise.allSettled(
    all.filters.puroks.map((purok) =>
      reports({ purok_id: purok.id }).then((report) => ({ purok, report }))
    )
  );

  await Promise.all(
    perPurok.map((result) =>
      result.status === 'fulfilled'
        ? putCache(reportCacheKey({ purok_id: result.value.purok.id }), result.value.report)
        : Promise.resolve()
    )
  );
}
function toList<T>(page: { data: T[]; meta: { total: number } }) {
  return { items: page.data, total: page.meta.total };
}
