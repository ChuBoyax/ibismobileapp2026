import { useMemo } from 'react';

import { RecordListScreen, type RecordItem } from '@/components/record-list-screen';
import { useRecordList } from '@/features/registration/use-record-list';
import { CacheKey } from '@/lib/db';
import { listResidents, type ResidentSummary } from '@/lib/api';

export default function ResidentsScreen() {
  const list = useRecordList<ResidentSummary>(listResidents, CacheKey.listResidents);

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
