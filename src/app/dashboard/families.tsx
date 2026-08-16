import { useMemo } from 'react';

import { RecordListScreen, type RecordItem } from '@/components/record-list-screen';
import { useRecordList } from '@/features/registration/use-record-list';
import { CacheKey } from '@/lib/db';
import { listFamilies, type FamilySummary } from '@/lib/api';

export default function FamiliesScreen() {
  const list = useRecordList<FamilySummary>(listFamilies, CacheKey.listFamilies);

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
      items={items}
      total={list.total}
      loading={list.loading}
      refreshing={list.refreshing}
      error={list.error}
      search={list.search}
      onSearchChange={list.setSearch}
      onRefresh={list.refresh}
    />
  );
}
