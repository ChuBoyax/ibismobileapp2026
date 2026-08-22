import { showFamily, showHousehold, showResident } from '@/lib/api';
import { getCache, putCache, recordCacheKey } from '@/lib/db';
import type { OutboxType } from '@/lib/outbox';

const SHOW = {
  resident: showResident,
  household: showHousehold,
  family: showFamily,
} as const;

/**
 * Kinukuha isa-isa ang buong tala kapag hindi ito ibinigay ng listahan.
 *
 * BAKIT MAY GANITO. Ang listahan ay humihingi ng `full=1`, at sa bagong
 * bersyon ng server ay isinasama nito ang buong laman ng bawat tala — isang
 * request, handa na ang lahat para sa offline na pag-edit.
 *
 * PERO HINDI LAHAT NG SERVER AY BAGO. Ang naka-deploy na live ay maaaring
 * mas luma kaysa sa code sa laptop, at tahimik lang nitong binabalewala ang
 * `full=1`. Ang bunga noon ay ang pinakamasamang uri ng sira: gumagana ang
 * listahan, mukhang maayos ang lahat, tapos sa bundok — kung saan wala nang
 * magagawa ang enumerator — doon lang lalabas na walang naka-tabing tala.
 *
 * Kaya kapag walang ibinigay ang server, tayo na ang kukuha. Mas marami
 * ngang request, pero ang tanong dito ay hindi "mabilis ba" kundi "gagana ba
 * mamaya kapag wala nang signal".
 *
 * TATLONG PAGPIPIGIL para hindi ito maging pabigat:
 *  1. Ang naka-tabi na ay nilalaktawan — karaniwan, iilan lang ang bago.
 *  2. Apat na sabay lang, hindi lahat nang sabay-sabay.
 *  3. Tahimik ang pagkabigo: pandagdag ito, hindi pangunahin. Kung hindi
 *     umabot ang isa, susubukan ulit sa susunod na pagbukas ng listahan.
 */

/** Ilan ang sabay na kinukuha. Sapat para mabilis, hindi sapat para bumigat. */
const CONCURRENCY = 4;

/** Iisang pagtakbo lang kada uri — iniiwasan ang doble kapag mabilis magbalik. */
const running = new Set<string>();

export async function backfillRecords(type: OutboxType, ids: number[]): Promise<void> {
  if (running.has(type) || ids.length === 0) return;

  running.add(type);

  try {
    // Alin ang wala pa? Sa pangalawang pagbukas, kadalasan ay wala nang
    // natitira at agad itong natatapos.
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
          // Hindi umabot ang isang tala. Susubukan ulit sa susunod —
          // hindi dapat mapigilan nito ang natitira.
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } finally {
    running.delete(type);
  }
}
