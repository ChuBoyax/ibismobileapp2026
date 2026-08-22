import type { Ionicons } from '@expo/vector-icons';

import type { SelectOption } from '@/constants/form-options';

export type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Isang sagot sa form. Array ang gamit ng multiple-choice at ng repeater. */
export type FieldValue = string | boolean | string[] | FormValues[] | null;

export type FormValues = Record<string, FieldValue>;

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'segmented'
  | 'toggle'
  | 'image'
  | 'repeater'
  /** Kinakalkula mula sa ibang sagot — hindi kayang baguhin ng gumagamit. */
  | 'computed';

/** Kondisyon na sinusuri laban sa kasalukuyang laman ng form. */
type Predicate = (values: FormValues) => boolean;

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  icon?: IoniconName;
  placeholder?: string;
  hint?: string;
  options?: readonly SelectOption[];
  keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address';
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';

  /** Maaaring palaging kailangan, o kailangan lang sa ilang sagot. */
  required?: boolean | Predicate;

  /* ── Panuntunan sa pagsusuri ─────────────────────────────────────── */

  /** Bilang lang ang matatatak — hinaharang na sa pagpindot, hindi lang sa dulo. */
  digitsOnly?: boolean;
  /** Eksaktong haba, tulad ng 11 na digit ng cellphone. */
  exactLength?: number;
  maxLength?: number;
  /** Saklaw ng numero, halimbawa taon ng pagtatapos. */
  minValue?: number;
  maxValue?: number;
  /** Hindi puwedeng lampas sa araw na ito — para sa kaarawan. */
  notFuture?: boolean;
  email?: boolean;

  /** Kinakalkula mula sa ibang field. Para lang sa uring `computed`. */
  compute?: (values: FormValues) => string;

  /* ── Para lang sa uring `repeater` ───────────────────────────────── */

  /** Mga tanong na inuulit kada entry. */
  itemFields?: FieldDef[];
  addLabel?: string;
  emptyText?: string;
  titleFor?: (item: FormValues, index: number) => string;

  visibleWhen?: Predicate;
};

export type SectionDef = {
  title: string;
  description?: string;
  icon: IoniconName;
  fields: FieldDef[];
};

export type StepDef = {
  id: string;
  title: string;
  shortTitle: string;
  icon: IoniconName;
  sections: SectionDef[];
};

export const fieldsOfStep = (step: StepDef): FieldDef[] =>
  step.sections.flatMap((section) => section.fields);

export const isFieldVisible = (field: FieldDef, values: FormValues): boolean =>
  field.visibleWhen ? field.visibleWhen(values) : true;

export const isFieldRequired = (field: FieldDef, values: FormValues): boolean =>
  typeof field.required === 'function' ? field.required(values) : field.required === true;

/** Walang laman ang isang sagot — pare-pareho ang pagsukat sa lahat ng uri. */
const isEmpty = (value: FieldValue): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;

  return false;
};

/**
 * Sinusuri ang isang field at ibinabalik ang mensahe kapag may mali.
 *
 * Ang layunin ay masabi agad sa nag-eencode kung ano ang kulang habang nasa
 * harap pa niya ang tao — hindi pagkatapos ng walong hakbang. Kaya ang
 * pagsusuri ay ipinapakita sa ilalim mismo ng field, at hinaharangan ang
 * pagpapatuloy hangga't may pulang natitira sa kasalukuyang hakbang.
 */
export function validateField(
  field: FieldDef,
  value: FieldValue,
  values: FormValues
): string | null {
  const required = isFieldRequired(field, values);

  if (isEmpty(value)) {
    return required ? `${field.label} is required.` : null;
  }

  // Sa loob mismo ng repeater at multiselect nangyayari ang sariling pagsusuri
  // nila, kaya dito ay pagkakaroon lang ng laman ang tinitingnan.
  if (typeof value !== 'string') return null;

  const text = value.trim();

  if (field.exactLength && text.length !== field.exactLength) {
    return text.length < field.exactLength
      ? `${field.label} is too short — needs ${field.exactLength} digits.`
      : `${field.label} is too long — needs ${field.exactLength} digits.`;
  }

  if (field.maxLength && text.length > field.maxLength) {
    return `${field.label} must be ${field.maxLength} characters or fewer.`;
  }

  if (field.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    return 'Please enter a valid email address.';
  }

  if (field.type === 'date') {
    return validateDate(field, text);
  }

  if (field.minValue !== undefined || field.maxValue !== undefined) {
    const numeric = Number(text);

    if (!Number.isFinite(numeric)) return `${field.label} must be a number.`;
    if (field.minValue !== undefined && numeric < field.minValue) {
      return `${field.label} must be ${field.minValue} or higher.`;
    }
    if (field.maxValue !== undefined && numeric > field.maxValue) {
      return `${field.label} must be ${field.maxValue} or lower.`;
    }
  }

  return null;
}

/**
 * MM/DD/YYYY patungong Date, o null kapag hindi ito umiiral na petsa.
 *
 * Sinasala ng Date ang mga imposibleng petsa tulad ng 02/31 sa pamamagitan
 * ng pag-usad sa susunod na buwan, kaya inihahambing pabalik ang bahagi.
 */
export function parseDateInput(text: string): Date | null {
  const match = text.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return null;

  const [, month, day, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  const valid =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day);

  return valid ? date : null;
}

/** Date patungong MM/DD/YYYY — iisa ang anyo ng petsa sa buong form. */
export function formatDateInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${month}/${day}/${date.getFullYear()}`;
}

function validateDate(field: FieldDef, text: string): string | null {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(text.trim())) return 'Use the format MM/DD/YYYY.';

  const date = parseDateInput(text);

  if (!date) return 'That date does not exist.';

  if (field.notFuture && date.getTime() > Date.now()) {
    return `${field.label} cannot be in the future.`;
  }

  return null;
}

/** Sinusuri ang buong hakbang. Ibinabalik ang mga mensahe kada field. */
export function validateStep(step: StepDef, values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fieldsOfStep(step)) {
    if (!isFieldVisible(field, values)) continue;

    const message = validateField(field, values[field.name] ?? null, values);

    if (message) errors[field.name] = message;
  }

  return errors;
}
