import { useMemo } from 'react';

import { RecordListScreen, type RecordItem } from '@/components/record-list-screen';
import { useRecordList } from '@/features/registration/use-record-list';
import { CacheKey } from '@/lib/db';
import { listHouseholds, type HouseholdSummary } from '@/lib/api';

export default function HouseholdsScreen() {
  const list = useRecordList<HouseholdSummary>(listHouseholds, CacheKey.listHouseholds);

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
          subtitle: [
            household.house_type,
            `${residents} resident${residents === 1 ? '' : 's'}`,
          ]
            .filter(Boolean)
            .join(' · '),
          tags: [
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
      editHref={(id) => `/registration/household?id=${id}`}
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
