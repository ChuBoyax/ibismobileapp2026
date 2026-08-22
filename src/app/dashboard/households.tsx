import { useMemo } from 'react';

import type { FilterGroup } from '@/components/filter-bar';
import { RecordListScreen, type RecordItem } from '@/components/record-list-screen';
import { barangayGroup, choicesFrom, matchesById } from '@/features/registration/list-filters';
import { useFormSources } from '@/features/registration/use-form-sources';
import { useRecordList } from '@/features/registration/use-record-list';
import { useProfile } from '@/lib/use-profile';
import { CacheKey } from '@/lib/db';
import { listHouseholdsFull, type HouseholdSummary, type ListFilters } from '@/lib/api';

/** Nasa labas ng component para hindi magbago ang pagkakakilanlan kada render. */
function matchesHousehold(item: HouseholdSummary, filters: ListFilters): boolean {
  return matchesById(item as unknown as Record<string, unknown>, filters, [
    'barangay_id',
    'purok_id',
    'house_type_id',
    'ownership_type_id',
  ]);
}

export default function HouseholdsScreen() {
  const list = useRecordList<HouseholdSummary>(
    listHouseholdsFull,
    CacheKey.listHouseholds,
    'household',
    matchesHousehold
  );

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
        key: 'house_type_id',
        label: 'House type',
        selected: list.filters.house_type_id ?? null,
        onSelect: (value) => setFilter('house_type_id', value),
        options: choicesFrom(sources.options, 'house_type', 'All types'),
      },
      {
        key: 'ownership_type_id',
        label: 'Ownership',
        selected: list.filters.ownership_type_id ?? null,
        onSelect: (value) => setFilter('ownership_type_id', value),
        options: choicesFrom(sources.options, 'ownership_type', 'All'),
      },
    ],
    [list.filters, setFilter, sources.options, choices]
  );

  const items = useMemo<RecordItem[]>(
    () =>
      list.items.map((household) => {
        // Mas mapagkakatiwalaan ang bilang na galing sa aktwal na kaugnayan
        // kaysa sa manwal na naisulat, pero panatilihin ang huli kapag wala pa
        // ang mga residente sa sistema.
        const residents = household.residents_count || household.number_of_residents || 0;

        return {
          id: String(household.id),
          title: household.house_number ?? `Household #${household.id}`,
          subtitle: [household.house_type, `${residents} resident${residents === 1 ? '' : 's'}`]
            .filter(Boolean)
            .join(' · '),
          tags: [
            household.purok,
            household.ownership_type,
            household.has_business ? household.business_name ?? 'With business' : null,
          ].filter((tag): tag is string => Boolean(tag)),
        };
      }),
    [list.items]
  );

  return (
    <RecordListScreen
      title="Households"
      subtitle="Household profiles"
      icon="home-outline"
      createHref="/registration/household"
      createLabel="New"
      openHref={(id) => `/registration/household?id=${id}`}
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
