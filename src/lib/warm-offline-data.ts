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
import { CacheKey, putCache, recordCacheKey, reportCacheKey } from '@/lib/db';
import type { OutboxType } from '@/lib/outbox';

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
 * Itinatabi ang listahan AT ang buong laman ng bawat tala.
 *
 * Dalawang magkaibang pangangailangan, iisang request. Ang listahan ay para
 * sa mga card; ang bawat buong tala ay para sa form kapag may pipindutin.
 * Kung ang huli ay kukunin lang isa-isa sa oras ng pagpindot, ang pag-edit
 * habang walang signal ay mabibigo — at doon mismo pinakakailangan.
 */
async function warmList<T>(type: OutboxType, request: Promise<FullListPage<T>>) {
  const page = await request;

  await Promise.all(
    (page.records ?? []).map((record) =>
      typeof record.id === 'number'
        ? putCache(recordCacheKey(type, record.id), record)
        : Promise.resolve()
    )
  );

  return toList(page);
}

/**
 * Ang laman ng registration form: mga dropdown at ang mga pagpipilian sa
 * sambahayan, pamilya at residente.
 *
 * DITO NAKASALALAY KUNG GAANO KABILIS BUMUKAS ANG FORM. Kung wala ang mga
 * ito, ang bawat pagbukas — bago man o pag-edit — ay maghihintay muna ng
 * server bago may maipakita. Sa lugar na walang signal, iyon ang buong
 * timeout bago pa man lumitaw ang unang tanong.
 *
 * Kasama rin sila sa mga chip ng filter, kaya ang paghahanap ayon sa purok
 * ay may pagpipilian kahit saan ka man naroon.
 */
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

/** Kasinghaba ng ginagamit ng useFormSources, para pareho ang laman. */
const PICKER_PAGE_SIZE = 100;

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
