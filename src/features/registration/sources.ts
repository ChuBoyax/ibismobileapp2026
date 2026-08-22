import type { SelectOption } from '@/constants/form-options';
import type { OptionGroups } from '@/lib/api';


export type FormSources = {
  options: OptionGroups;
  households: SelectOption[];
  families: SelectOption[];
  residents: SelectOption[];
};

export const EMPTY_SOURCES: FormSources = {
  options: {},
  households: [],
  families: [],
  residents: [],
};
