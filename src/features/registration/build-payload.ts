import {
  fieldsOfStep,
  isFieldVisible,
  type FieldDef,
  type FormValues,
  type StepDef,
} from '@/components/form/types';

/**
 * Ginagawang payload ng API ang mga sagot sa form.
 *
 * Apat na pagsasaayos ang nangyayari rito:
 *  1. Hindi isinasama ang mga nakatagong field — kung hindi PWD ang residente,
 *     wala dapat isinasamang uri ng kapansanan kahit napindot iyon kanina.
 *  2. Numero ang ipinapadala sa mga foreign key (`*_id`).
 *  3. Ginagawang YYYY-MM-DD ang petsa, na siyang inaasahan ng Laravel.
 *  4. Ang mga repeater ay ipinapadala bilang array ng object, katulad ng
 *     inaasahan ng mga hasMany na ugnayan sa server.
 */
export function buildPayload(steps: StepDef[], values: FormValues): Record<string, unknown> {
  const fields = steps.flatMap(fieldsOfStep);

  return buildFrom(fields, values);
}

function buildFrom(fields: FieldDef[], values: FormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    if (!isFieldVisible(field, values)) continue;

    // Kinakalkula lang ang mga ito sa harapan — sa server nagmumula ang
    // opisyal na halaga, kaya hindi na kailangang ipadala pabalik.
    if (field.type === 'computed') continue;

    const raw = values[field.name];

    if (field.type === 'toggle') {
      payload[field.name] = raw === true;
      continue;
    }

    if (field.type === 'repeater') {
      const items = Array.isArray(raw) && typeof raw[0] !== 'string' ? (raw as FormValues[]) : [];

      if (items.length > 0) {
        payload[field.name] = items.map((item) => buildFrom(field.itemFields ?? [], item));
      }
      continue;
    }

    if (field.type === 'multiselect') {
      const selected = Array.isArray(raw) ? (raw as string[]) : [];

      if (selected.length > 0) {
        payload[field.name] = selected.map(toIdOrText);
      }
      continue;
    }

    if (typeof raw !== 'string' || raw.trim() === '') continue;

    const value = raw.trim();

    if (field.type === 'date') {
      const iso = toIsoDate(value);
      if (iso) payload[field.name] = iso;
      continue;
    }

    if (field.name.endsWith('_id')) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) payload[field.name] = numeric;
      continue;
    }

    payload[field.name] = value;
  }

  return payload;
}

/** Id ng option kung numero, kung hindi ay ang mismong teksto. */
function toIdOrText(value: string): number | string {
  const numeric = Number(value);

  return Number.isFinite(numeric) && value.trim() !== '' ? numeric : value;
}

/**
 * MM/DD/YYYY patungong YYYY-MM-DD. Ibinabalik ang null kapag kulang pa ang
 * tinipang petsa, para hindi makapagpadala ng bali-baling halaga.
 */
function toIsoDate(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return null;

  const [, month, day, year] = match;

  return `${year}-${month}-${day}`;
}
