import type { SelectOption } from '@/constants/form-options';
import type { OptionGroups } from '@/lib/api';

/**
 * Isinasalin ang sagot ng `/api/ibis/options` sa hugis na kaya ng mga field.
 *
 * Dalawa ang paraan dahil dalawa rin ang uri ng column sa RBI:
 *  - `byId`   — para sa mga foreign key (`civil_status_id`), id ang iniimbak.
 *  - `byName` — para sa mga tekstong column (`sex`, `citizenship`), ang mismong
 *               pangalan ang iniimbak kahit may talaan pa rin ito sa `options`.
 */

/** Para sa mga field na nagtatapos sa `_id`. */
export const byId = (groups: OptionGroups, category: string): SelectOption[] =>
  (groups[category] ?? []).map((option) => ({
    value: String(option.id),
    label: option.name,
  }));

/** Para sa mga tekstong column na may talaan pa rin sa `options`. */
export const byName = (groups: OptionGroups, category: string): SelectOption[] =>
  (groups[category] ?? []).map((option) => ({
    value: option.name,
    label: option.name,
  }));
