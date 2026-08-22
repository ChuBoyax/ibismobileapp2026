import { useEffect, useState } from 'react';

import { fetchOptions, listFamilies, listHouseholds, listResidents } from '@/lib/api';
import { CacheKey, getCache, putCache } from '@/lib/db';
import { pendingChoices } from '@/lib/outbox';

import { EMPTY_SOURCES, type FormSources } from './sources';


export type SourceNeeds = {
  households?: boolean;
  families?: boolean;
  residents?: boolean;
};


const PICKER_PAGE_SIZE = 100;

type Choice = { value: string; label: string };

type State = {
  sources: FormSources;
  loading: boolean;
  error: string | null;
  
  offline: boolean;
 
  fetchedAt: Date | null;
};


export function useFormSources(needs: SourceNeeds = {}) {
  const { households = false, families = false, residents = false } = needs;

  const [state, setState] = useState<State>({
    sources: EMPTY_SOURCES,
    loading: true,
    error: null,
    offline: false,
    fetchedAt: null,
  });


  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function run() {
      if (attempt > 0) {
        setState((prev) => ({ ...prev, loading: true, error: null }));
      }

    
      const early = await readCache({ households, families, residents });

      if (early && active && attempt === 0) {
        setState({
          sources: await withPending(early.sources, { households, families, residents }),
          loading: false,
          error: null,
          offline: true,
          fetchedAt: early.fetchedAt,
        });
      }

      try {
        const [optionsResult, householdList, familyList, residentList] = await Promise.all([
          fetchOptions(),
          households ? listHouseholds({ perPage: PICKER_PAGE_SIZE }) : null,
          families ? listFamilies({ perPage: PICKER_PAGE_SIZE }) : null,
          residents ? listResidents({ perPage: PICKER_PAGE_SIZE }) : null,
        ]);

        const sources: FormSources = {
          options: optionsResult.options,
          households:
            householdList?.data.map((item) => ({
              value: String(item.id),
              label: item.house_number ?? `Household #${item.id}`,
            })) ?? [],
          families:
            familyList?.data.map((item) => ({
              value: String(item.id),
              label: item.family_name ?? `Family #${item.id}`,
            })) ?? [],
          residents:
            residentList?.data.map((item) => ({
              value: String(item.id),
              label: item.full_name,
            })) ?? [],
        };

      
        putCache(CacheKey.formOptions, sources.options);
        if (householdList) putCache(CacheKey.formHouseholds, sources.households);
        if (familyList) putCache(CacheKey.formFamilies, sources.families);
        if (residentList) putCache(CacheKey.formResidents, sources.residents);

        const shown = await withPending(sources, { households, families, residents });

        if (active) {
          setState({
            sources: shown,
            loading: false,
            error: null,
            offline: false,
            fetchedAt: new Date(),
          });
        }
      } catch (error) {
        const cached = await readCache({ households, families, residents });

        if (!active) return;

        if (cached) {
          setState({
            sources: await withPending(cached.sources, { households, families, residents }),
            loading: false,
            error: null,
            offline: true,
            fetchedAt: cached.fetchedAt,
          });
          return;
        }

        setState({
          sources: EMPTY_SOURCES,
          loading: false,
          offline: false,
          fetchedAt: null,
          error:
            error instanceof Error
              ? `${error.message} Open this form once while connected so it can be used offline later.`
              : 'Cannot load the form right now.',
        });
      }
    }

    void run();

    return () => {
      active = false;
    };
  }, [households, families, residents, attempt]);

  return { ...state, reload: () => setAttempt((count) => count + 1) };
}


async function withPending(sources: FormSources, needs: Required<SourceNeeds>) {
  const [households, families, residents] = await Promise.all([
    needs.households ? pendingChoices('household') : [],
    needs.families ? pendingChoices('family') : [],
    needs.residents ? pendingChoices('resident') : [],
  ]);

  return {
    ...sources,
    households: [...households, ...sources.households],
    families: [...families, ...sources.families],
    residents: [...residents, ...sources.residents],
  };
}


async function readCache(needs: Required<SourceNeeds>) {
  const [options, householdList, familyList, residentList] = await Promise.all([
    getCache<FormSources['options']>(CacheKey.formOptions),
    needs.households ? getCache<Choice[]>(CacheKey.formHouseholds) : null,
    needs.families ? getCache<Choice[]>(CacheKey.formFamilies) : null,
    needs.residents ? getCache<Choice[]>(CacheKey.formResidents) : null,
  ]);

  if (!options) return null;

  return {
    sources: {
      options: options.value,
      households: householdList?.value ?? [],
      families: familyList?.value ?? [],
      residents: residentList?.value ?? [],
    } as FormSources,
    fetchedAt: options.updatedAt,
  };
}


export async function warmFormSources(): Promise<void> {
  try {
    const [options, householdList, familyList, residentList] = await Promise.all([
      fetchOptions(),
      listHouseholds({ perPage: PICKER_PAGE_SIZE }),
      listFamilies({ perPage: PICKER_PAGE_SIZE }),
      listResidents({ perPage: PICKER_PAGE_SIZE }),
    ]);

    await Promise.all([
      putCache(CacheKey.formOptions, options.options),
      putCache(
        CacheKey.formHouseholds,
        householdList.data.map((item) => ({
          value: String(item.id),
          label: item.house_number ?? `Household #${item.id}`,
        }))
      ),
      putCache(
        CacheKey.formFamilies,
        familyList.data.map((item) => ({
          value: String(item.id),
          label: item.family_name ?? `Family #${item.id}`,
        }))
      ),
      putCache(
        CacheKey.formResidents,
        residentList.data.map((item) => ({
          value: String(item.id),
          label: item.full_name,
        }))
      ),
    ]);
  } catch {
   
  }
}
