import type { SelectOption } from '@/constants/form-options';
import type { OptionGroups } from '@/lib/api';

/**
 * Lahat ng galing sa server na kailangan ng mga registration form.
 *
 * Bukod sa `options`, may mga field na tumutukoy sa ibang tala at hindi sa
 * talaan ng option — ang sambahayan ng residente, halimbawa. Sabay silang
 * kinukuha sa pagbukas ng form para iisang paghihintay lang ang nakikita ng
 * gumagamit.
 */
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
