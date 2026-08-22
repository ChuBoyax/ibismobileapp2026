import {
  fieldsOfStep,
  type FieldDef,
  type FormValues,
  type StepDef,
} from '@/components/form/types';

export function buildValues(steps: StepDef[], record: Record<string, unknown>): FormValues {
  return valuesFrom(steps.flatMap(fieldsOfStep), record);
}

function valuesFrom(fields: FieldDef[], record: Record<string, unknown>): FormValues {
  const values: FormValues = {};

  for (const field of fields) {
   
    if (field.type === 'computed') continue;

   
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


function toOptionValue(field: FieldDef, raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;

 
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


function isTruthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';

  return false;
}


function toFormDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return null;

  const [, year, month, day] = match;

  return `${month}/${day}/${year}`;
}
