import type { SelectOption } from '@/constants/form-options';
import type { OptionGroups } from '@/lib/api';


export const byId = (groups: OptionGroups, category: string): SelectOption[] =>
  (groups[category] ?? []).map((option) => ({
    value: String(option.id),
    label: option.name,
  }));


export const byName = (groups: OptionGroups, category: string): SelectOption[] =>
  (groups[category] ?? []).map((option) => ({
    value: option.name,
    label: option.name,
  }));
