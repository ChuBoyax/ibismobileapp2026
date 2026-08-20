import {
  fieldsOfStep,
  type FieldDef,
  type FormValues,
  type StepDef,
} from '@/components/form/types';

/**
 * Ginagawang sagot sa form ang talang galing sa server.
 *
 * Ito ang kabaligtaran ng `buildPayload`. Kapag pinindot ang isang tala sa
 * listahan, bumubukas ang parehong labing-isang hakbang na form — pero puno
 * na ng dating datos, kaya ang pag-edit ng isang numero ng telepono ay hindi
 * nangangahulugang muling pag-eencode ng lahat.
 *
 * Apat na bagay ang kailangang ibalik sa dating anyo:
 *  1. Teksto ang lahat sa form, kahit numero ang laman ng database.
 *  2. YYYY-MM-DD (o buong timestamp) patungong MM/DD/YYYY.
 *  3. Ang mga hasMany na ugnayan ay nagiging laman ng repeater.
 *  4. Ang mga option ay itinutugma sa id — at kapag pangalan ang nakaimbak,
 *     sa pangalan hinahanap ang id.
 *
 * ANG LARAWAN AY SADYANG HINDI IBINABALIK. Ang hawak ng server ay URL, hindi
 * file; kung ipapadala iyon pabalik, tatanggihan ito ng panuntunang `image`
 * at magiging 422 ang buong pag-save. Wala namang mawawala: hindi hinahawakan
 * ng backend ang dating litrato kapag walang bagong ipinadala.
 */
export function buildValues(steps: StepDef[], record: Record<string, unknown>): FormValues {
  return valuesFrom(steps.flatMap(fieldsOfStep), record);
}

function valuesFrom(fields: FieldDef[], record: Record<string, unknown>): FormValues {
  const values: FormValues = {};

  for (const field of fields) {
    // Sa server nagmumula ang opisyal na halaga ng mga ito — muli itong
    // kinakalkula ng form mula sa ibang sagot.
    if (field.type === 'computed') continue;

    // Tingnan ang paliwanag sa itaas: URL ang hawak ng server, hindi file.
    if (field.type === 'image') continue;

    const raw = record[field.name];

    if (field.type === 'toggle') {
      values[field.name] = isTruthy(raw);
      continue;
    }

    if (field.type === 'repeater') {
      const items = Array.isArray(raw) ? raw : [];

      values[field.name] = items
        .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
        .map((item) => valuesFrom(field.itemFields ?? [], item));
      continue;
    }

    if (field.type === 'multiselect') {
      // Minsan iisang halaga lang ang nakaimbak imbes na array — ang lumang
      // `citizenship` ay teksto lang na "Filipino". Ipinapasok pa rin ito.
      const list = Array.isArray(raw) ? raw : raw === null || raw === undefined ? [] : [raw];

      values[field.name] = list
        .map((item) => toOptionValue(field, item))
        .filter((item): item is string => item !== null);
      continue;
    }

    if (raw === null || raw === undefined) continue;

    if (field.type === 'date') {
      const formatted = toFormDate(raw);
      if (formatted) values[field.name] = formatted;
      continue;
    }

    if (field.options?.length) {
      const matched = toOptionValue(field, raw);
      if (matched) values[field.name] = matched;
      continue;
    }

    if (typeof raw === 'object') continue;

    values[field.name] = String(raw);
  }

  return values;
}

/**
 * Ang naiimbak na halaga patungo sa halaga ng option.
 *
 * Karaniwan ay tuwiran ang tugma — id sa id. Pero may lumang tala kung saan
 * pangalan ang naiimbak sa halip na id (`citizenship` ay "Filipino"), kaya
 * hinahanap din ito sa mga label. Kung hindi tumugma kahit saan, wala:
 * mas mabuting blangkong dropdown na sasagutin ng user kaysa idang hindi
 * naman pala tumutukoy sa anuman.
 */
function toOptionValue(field: FieldDef, raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;

  // Ang naka-nest na object ay galing sa ugnayan (`purok: { id, name }`).
  const value =
    typeof raw === 'object'
      ? ((raw as Record<string, unknown>).id ?? (raw as Record<string, unknown>).value ?? null)
      : raw;

  if (value === null || value === undefined) return null;

  const text = String(value);
  const options = field.options ?? [];

  if (options.length === 0) return text;
  if (options.some((option) => option.value === text)) return text;

  const byLabel = options.find((option) => option.label.toLowerCase() === text.toLowerCase());

  return byLabel ? byLabel.value : null;
}

/** Tumatanggap ng 1, "1", true at "true" — magkakaiba ang pinagmulan nila. */
function isTruthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';

  return false;
}

/**
 * YYYY-MM-DD patungong MM/DD/YYYY. Tinatanggap din ang buong timestamp
 * ("2026-08-07T04:00:55.000000Z") dahil ganoon ibinabalik ng Laravel ang
 * ilang column.
 */
function toFormDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return null;

  const [, year, month, day] = match;

  return `${month}/${day}/${year}`;
}
