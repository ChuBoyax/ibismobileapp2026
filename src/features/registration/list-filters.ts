import type { FilterGroup, FilterOption } from '@/components/filter-bar';
import type { BarangayChoice, ListFilters, OptionGroups } from '@/lib/api';


export function choicesFrom(
  options: OptionGroups,
  key: string,
  allLabel: string
): FilterOption[] {
  const group = options[key] ?? [];

  return [
    { value: null, label: allLabel },
    ...group.map((option) => ({ value: option.id, label: option.name })),
  ];
}


export function matchesById(
  item: Record<string, unknown>,
  filters: ListFilters,
  keys: string[]
): boolean {
  return keys.every((key) => {
    const wanted = filters[key];

    if (wanted === null || wanted === undefined || wanted === '') return true;

    return String(item[key] ?? '') === String(wanted);
  });
}


export const RESIDENT_SECTORS: { key: string; label: string; column: string }[] = [
  { key: 'senior', label: 'Senior citizens', column: 'senior' },
  { key: 'pwd', label: 'Persons with disability', column: 'pwd' },
  { key: '4ps', label: '4Ps members', column: 'is_4ps_member' },
  { key: 'solo_parent', label: 'Solo parents', column: 'solo_parent' },
  { key: 'osy', label: 'Out-of-school youth', column: 'osy' },
  { key: 'ofw', label: 'OFWs', column: 'ofw' },
];

export const SECTOR_CHOICES: FilterOption[] = [
  { value: null, label: 'All residents' },
  ...RESIDENT_SECTORS.map((sector) => ({ value: sector.key, label: sector.label })),
];


export function matchesSector(item: Record<string, unknown>, value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;

  const sector = RESIDENT_SECTORS.find((entry) => entry.key === value);

  return sector ? item[sector.column] === true : true;
}


export function barangayGroup(
  choices: BarangayChoice[],
  selected: string | number | null,
  onSelect: (value: string | number | null) => void
): FilterGroup[] {
  if (choices.length < 2) return [];

  return [
    {
      key: 'barangay_id',
      label: 'Barangay',
      selected,
      onSelect,
      options: [
        { value: null, label: 'All barangays' },
        ...choices.map((barangay) => ({ value: barangay.id, label: barangay.name })),
      ],
    },
  ];
}
