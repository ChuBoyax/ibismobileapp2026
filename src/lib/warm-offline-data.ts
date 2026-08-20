import {
  dashboard,
  listFamilies,
  listHouseholds,
  listResidents,
  notifications,
  reports,
} from '@/lib/api';
import { CacheKey, putCache, reportCacheKey } from '@/lib/db';

/**
 * Inihahanda ang lahat ng ipapakita ng app habang may koneksyon pa.
 *
 * ITO ANG NAGPAPAGANA NG OFFLINE.
 *
 * Ang cache ay napupuno lang kapag binuksan ng user ang isang screen habang
 * online. Ibig sabihin, ang bagong install na dinala agad sa lugar na walang
 * signal ay blangko sa lahat ng dako — hindi dahil sira, kundi dahil wala
 * pang nakukuha kahit kailan.
 *
 * Kaya sa sandaling matagumpay ang online na login, kinukuha na natin ang
 * lahat nang sabay-sabay. Isang beses na paghihintay ng ilang segundo,
 * kapalit ang app na may laman kahit saan pa dalhin.
 *
 * Tahimik itong nabibigo: kung mahina ang signal at hindi lahat ay nakuha,
 * hindi dapat mapigilan ang user sa pagpasok. Ang mga screen mismo ang
 * kukuha ulit kapag binuksan.
 */
export async function warmOfflineData(): Promise<void> {
  await Promise.allSettled([warmScreens(), warmReports()]);
}

async function warmScreens(): Promise<void> {
  const tasks: [string, Promise<unknown>][] = [
    [CacheKey.dashboard, dashboard()],
    [CacheKey.notifications, notifications().then((result) => result.notifications)],
    [CacheKey.listResidents, listResidents({ perPage: 50 }).then(toList)],
    [CacheKey.listFamilies, listFamilies({ perPage: 50 }).then(toList)],
    [CacheKey.listHouseholds, listHouseholds({ perPage: 50 }).then(toList)],
  ];

  // allSettled, hindi all: ang isang nabigong bahagi ay hindi dapat magbura
  // sa apat na matagumpay na nakuha.
  const results = await Promise.allSettled(tasks.map(([, task]) => task));

  await Promise.all(
    results.map((result, index) =>
      result.status === 'fulfilled' ? putCache(tasks[index][0], result.value) : Promise.resolve()
    )
  );
}

/**
 * Ang ulat ay hindi kayang salain sa cellphone — buod na bilang ang laman
 * nito, hindi hilaw na tala. Kaya ang bawat kombinasyon ng filter ay
 * kailangang hiwalay na kunin habang may koneksyon.
 *
 * ANG PUROK LANG ANG INUUNA, at sinasadya iyon. Isa itong request kada
 * purok — mga siyam sa karaniwang barangay. Kung isasama pa ang kasarian at
 * pangkat ng edad sa lahat ng kombinasyon, aabot ito ng mahigit isang daan;
 * matagal na paghihintay sa login para sa bagay na bihirang gamitin sa
 * bundok. Ang purok ang paraan ng paghahati sa field, kaya iyon ang pinipili.
 *
 * Ang ibang kombinasyon ay naitatago pa rin kapag binuksan habang online.
 */
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

/** Kaparehong hugis ng itinatabi ng useRecordList. */
function toList<T>(page: { data: T[]; meta: { total: number } }) {
  return { items: page.data, total: page.meta.total };
}
