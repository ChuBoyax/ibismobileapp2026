import {
  isFieldVisible,
  type FieldDef,
  type FormValues,
  type IoniconName,
  type StepDef,
} from '@/components/form/types';

import type { ExistingPhotos } from './existing-photos';

/** Isang sagot na ipinapakita bilang teksto. */
export type SummaryTextEntry = {
  kind: 'text';
  name: string;
  label: string;
  display: string;
};

/** Isang larawan. Hindi ito kayang ipahayag bilang teksto, kaya hiwalay. */
export type SummaryPhotoEntry = {
  kind: 'photo';
  name: string;
  label: string;
  /** Bagong pinili sa telepono, o URL ng naka-upload na. Wala kapag blangko. */
  uri: string | null;
  /** Totoo kapag nasa server na ito, hindi pa lang napipili sa telepono. */
  uploaded: boolean;
};

export type SummaryEntry = SummaryTextEntry | SummaryPhotoEntry;

export type SummaryGroup = {
  /** Alin sa mga hakbang — dito bumabalik ang pindutang "edit". */
  index: number;
  title: string;
  icon: IoniconName;
  entries: SummaryEntry[];
};

/** Walang sagot. Iisa ang tanda nito sa review at sa view page. */
export const EMPTY = '—';

/**
 * Ginagawang mababasang buod ang mga sagot sa form.
 *
 * IISA ANG PINAGMUMULAN NG REVIEW AT NG VIEW PAGE.
 *
 * Dalawang beses lumalabas ang parehong buod: bago mag-save, at tuwing
 * binubuksan ang isang tala mula sa listahan. Kung dalawa ang gumagawa nito,
 * dalawa rin ang kailangang alalahanin sa bawat bagong field — at ang isa sa
 * kanila ay tiyak na malilimutan. Binubuo ito mismo sa schema, kaya kusang
 * lumalabas sa dalawang lugar ang anumang idadagdag doon.
 */
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
    // Ang nasa telepono ang nauuna: iyon ang kapapalit lang ng gumagamit, at
    // iyon ang mapupunta sa server kapag na-save.
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

  /*
    ANG MGA ARRAY AY DATING LUMALABAS NA "—".

    Ang lumang buod ay teksto lang ang binabasa, kaya ang bawat multiselect at
    bawat repeater ay walang laman ang hitsura kahit puno. Sa review ay
    nakakalito iyon; sa view page ay mas malala — parang walang naitalang
    bakuna ang isang batang may lima.
  */
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

/**
 * Ilang tanong ang may sagot.
 *
 * Hindi binibilang ang "No": ito ang halaga ng bawat hindi pa nagagalaw na
 * toggle, kaya ang pagbilang nito ay nagsasabing puno na ang isang form na
 * halos blangko pa.
 */
export function countFilled(groups: SummaryGroup[]): number {
  return groups
    .flatMap((group) => group.entries)
    .filter((entry) =>
      entry.kind === 'photo' ? !!entry.uri : entry.display !== EMPTY && entry.display !== 'No'
    ).length;
}
