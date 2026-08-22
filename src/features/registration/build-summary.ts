import {
  isFieldVisible,
  type FieldDef,
  type FormValues,
  type IoniconName,
  type StepDef,
} from '@/components/form/types';

import type { ExistingPhotos } from './existing-photos';


export type SummaryTextEntry = {
  kind: 'text';
  name: string;
  label: string;
  display: string;
};


export type SummaryPhotoEntry = {
  kind: 'photo';
  name: string;
  label: string;
  
  uri: string | null;
 
  uploaded: boolean;
};

export type SummaryEntry = SummaryTextEntry | SummaryPhotoEntry;

export type SummaryGroup = {
  
  index: number;
  title: string;
  icon: IoniconName;
  entries: SummaryEntry[];
};


export const EMPTY = '—';


export function buildSummary(
  steps: StepDef[],
  values: FormValues,
  photos: ExistingPhotos = {}
): SummaryGroup[] {
  return steps.map((step, index) => ({
    index,
    title: step.title,
    icon: step.icon,
    entries: step.sections
      .flatMap((section) => section.fields)
      .filter((field) => isFieldVisible(field, values))
      .map((field) => entryFor(field, values, photos)),
  }));
}

function entryFor(field: FieldDef, values: FormValues, photos: ExistingPhotos): SummaryEntry {
  const raw = values[field.name];

  if (field.type === 'image') {
   
    const picked = typeof raw === 'string' && raw.trim() ? raw : null;
    const uploaded = photos[field.name] ?? null;

    return {
      kind: 'photo',
      name: field.name,
      label: field.label,
      uri: picked ?? uploaded,
      uploaded: !picked && !!uploaded,
    };
  }

  return {
    kind: 'text',
    name: field.name,
    label: field.label,
    display: displayFor(field, raw, values),
  };
}

function displayFor(field: FieldDef, raw: unknown, values: FormValues): string {
  if (field.type === 'toggle') return raw === true ? 'Yes' : 'No';

  if (field.type === 'computed') {
    const computed = field.compute ? field.compute(values) : '';
    return computed.trim() || EMPTY;
  }

 
  if (field.type === 'multiselect') {
    const selected = Array.isArray(raw) ? (raw as string[]) : [];

    if (selected.length === 0) return EMPTY;

    const labels = selected.map(
      (value) => field.options?.find((option) => option.value === value)?.label ?? value
    );

    return labels.join(', ');
  }

  if (field.type === 'repeater') {
    const items = Array.isArray(raw) ? raw : [];

    if (items.length === 0) return EMPTY;

    return `${items.length} ${items.length === 1 ? 'entry' : 'entries'}`;
  }

  if (field.options && typeof raw === 'string') {
    return field.options.find((option) => option.value === raw)?.label ?? EMPTY;
  }

  return typeof raw === 'string' && raw.trim() ? raw : EMPTY;
}


export function countFilled(groups: SummaryGroup[]): number {
  return groups
    .flatMap((group) => group.entries)
    .filter((entry) =>
      entry.kind === 'photo' ? !!entry.uri : entry.display !== EMPTY && entry.display !== 'No'
    ).length;
}
