import {
  fieldsOfStep,
  isFieldVisible,
  type FieldDef,
  type FormValues,
  type StepDef,
} from '@/components/form/types';
import { isLocalRef } from '@/lib/local-refs';


export function buildPayload(steps: StepDef[], values: FormValues): Record<string, unknown> {
  const fields = steps.flatMap(fieldsOfStep);

  return buildFrom(fields, values);
}

function buildFrom(fields: FieldDef[], values: FormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    if (!isFieldVisible(field, values)) continue;

   
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
     
      if (isLocalRef(value)) {
        payload[field.name] = value;
        continue;
      }

      const numeric = Number(value);
      if (Number.isFinite(numeric)) payload[field.name] = numeric;
      continue;
    }

    payload[field.name] = value;
  }

  return payload;
}


function toIdOrText(value: string): number | string {
 
  if (isLocalRef(value)) return value;

  const numeric = Number(value);

  return Number.isFinite(numeric) && value.trim() !== '' ? numeric : value;
}


function toIsoDate(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return null;

  const [, month, day, year] = match;

  return `${year}-${month}-${day}`;
}
