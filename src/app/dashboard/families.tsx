import { useMemo } from 'react';

import type { FilterGroup } from '@/components/filter-bar';
import { RecordListScreen, type RecordItem } from '@/components/record-list-screen';
import { barangayGroup, choicesFrom, matchesById } from '@/features/registration/list-filters';
import { useFormSources } from '@/features/registration/use-form-sources';
import { useRecordList } from '@/features/registration/use-record-list';
import { useProfile } from '@/lib/use-profile';
import { CacheKey } from '@/lib/db';
import { listFamiliesFull, type FamilySummary, type ListFilters } from '@/lib/api';

/** Nasa labas ng component para hindi magbago ang pagkakakilanlan kada render. */
function matchesFamily(item: FamilySummary, filters: ListFilters): boolean {
  return matchesById(item as unknown as Record<string, unknown>, filters, [
    'barangay_id',
    'family_type_id',
    'income_level_id',
  ]);
}

export default function FamiliesScreen() {
  const list = useRecordList<FamilySummary>(
    listFamiliesFull,
    CacheKey.listFamilies,
    'family',
    matchesFamily
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
        key: 'family_type_id',
        label: 'Family type',
        selected: list.filters.family_type_id ?? null,
        onSelect: (value) => setFilter('family_type_id', value),
        options: choicesFrom(sources.options, 'family_type', 'All types'),
      },
      {
        key: 'income_level_id',
        label: 'Income level',
        selected: list.filters.income_level_id ?? null,
        onSelect: (value) => setFilter('income_level_id', value),
        options: choicesFrom(sources.options, 'income_level', 'All levels'),
      },
    ],
    [list.filters, setFilter, sources.options, choices]
  );

  const items = useMemo<RecordItem[]>(
    () =>
      list.items.map((family) => ({
        id: String(family.id),
        title: family.family_name ?? `Family #${family.id}`,
        subtitle: [
          family.head_name ? `Head: ${family.head_name}` : 'No head assigned',
          `${family.members_count} member${family.members_count === 1 ? '' : 's'}`,
        ].join(' · '),
        tags: [family.family_type, family.income_level].filter((tag): tag is string =>
          Boolean(tag)
        ),
      })),
    [list.items]
  );

  return (
    <RecordListScreen
      title="Families"
      subtitle="Family groupings"
      icon="person-add-outline"
      createHref="/registration/family"
      createLabel="New"
      editHref={(id) => `/registration/family?id=${id}`}
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
