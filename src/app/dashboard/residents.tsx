import { useMemo } from 'react';

import type { FilterGroup } from '@/components/filter-bar';
import { RecordListScreen, type RecordItem } from '@/components/record-list-screen';
import {
  barangayGroup,
  choicesFrom,
  matchesById,
  matchesSector,
  SECTOR_CHOICES,
} from '@/features/registration/list-filters';
import { useFormSources } from '@/features/registration/use-form-sources';
import { useRecordList } from '@/features/registration/use-record-list';
import { useProfile } from '@/lib/use-profile';
import { CacheKey } from '@/lib/db';
import { listResidentsFull, type ListFilters, type ResidentSummary } from '@/lib/api';

const SEX_CHOICES = [
  { value: null, label: 'All' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
];

/**
 * Ang panuntunan ng pagsasala kapag walang koneksyon.
 *
 * Nasa labas ng component para hindi ito magbago sa bawat render — kung
 * mag-iiba ang pagkakakilanlan nito, muling tatakbo ang pagkuha sa listahan
 * nang paulit-ulit.
 */
function matchesResident(item: ResidentSummary, filters: ListFilters): boolean {
  const record = item as unknown as Record<string, unknown>;

  return (
    matchesById(record, filters, ['purok_id', 'civil_status_id', 'sex', 'barangay_id']) &&
    matchesSector(record, filters.sector)
  );
}

export default function ResidentsScreen() {
  const list = useRecordList<ResidentSummary>(
    listResidentsFull,
    CacheKey.listResidents,
    'resident',
    matchesResident
  );

  // Walang hinihinging kaugnay na listahan — ang laman lang ng dropdown ang
  // kailangan dito, at naka-tabi na iyon mula sa registration form.
  const { sources } = useFormSources();
  const profile = useProfile();
  // Naka-memo: kung bagong array ito kada render, wala nang silbi ang
  // useMemo sa ibaba at muling gagawa ng hanay sa bawat pindot.
  const choices = useMemo(
    () => profile?.barangays.map((b) => ({ id: b.id, name: b.name.trim() })) ?? [],
    [profile]
  );

  const setFilter = list.setFilter;

  const filters = useMemo<FilterGroup[]>(
    () => [
      ...barangayGroup(choices, list.filters.barangay_id ?? null, (value) =>
        setFilter('barangay_id', value)
      ),
      {
        key: 'purok_id',
        label: 'Purok',
        selected: list.filters.purok_id ?? null,
        onSelect: (value) => setFilter('purok_id', value),
        options: choicesFrom(sources.options, 'sitio', 'All puroks'),
      },
      {
        key: 'sex',
        label: 'Sex',
        selected: list.filters.sex ?? null,
        onSelect: (value) => setFilter('sex', value),
        options: SEX_CHOICES,
      },
      {
        key: 'civil_status_id',
        label: 'Civil status',
        selected: list.filters.civil_status_id ?? null,
        onSelect: (value) => setFilter('civil_status_id', value),
        options: choicesFrom(sources.options, 'civil_status', 'All'),
      },
      {
        key: 'sector',
        label: 'Sector',
        selected: list.filters.sector ?? null,
        onSelect: (value) => setFilter('sector', value),
        options: SECTOR_CHOICES,
      },
    ],
    [list.filters, setFilter, sources.options, choices]
  );

  const items = useMemo<RecordItem[]>(
    () =>
      list.items.map((resident) => ({
        id: String(resident.id),
        title: resident.full_name,
        subtitle: [
          resident.age !== null ? `${resident.age} years old` : null,
          resident.sex,
          resident.civil_status,
        ]
          .filter(Boolean)
          .join(' · '),
        // Ang mga sektor lang na totoo ang ipinapakita — mas mabilis basahin
        // ang tatlong tatak kaysa hanay ng "Hindi" na walang sinasabi.
        tags: [
          resident.purok,
          resident.senior ? 'Senior' : null,
          resident.pwd ? 'PWD' : null,
          resident.is_4ps_member ? '4Ps' : null,
          resident.solo_parent ? 'Solo Parent' : null,
          resident.osy ? 'OSY' : null,
        ].filter((tag): tag is string => Boolean(tag)),
      })),
    [list.items]
  );

  return (
    <RecordListScreen
      title="Residents"
      subtitle="Barangay resident records"
      icon="people-outline"
      createHref="/registration/resident"
      createLabel="New"
      editHref={(id) => `/registration/resident?id=${id}`}
      items={items}
      total={list.total}
      loading={list.loading}
      refreshing={list.refreshing}
      error={list.error}
      search={list.search}
      onSearchChange={list.setSearch}
      filters={filters}
      onClearFilters={list.clearFilters}
      onRefresh={list.refresh}
    />
  );
}
