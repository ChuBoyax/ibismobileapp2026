import { useCallback, useEffect, useState } from 'react';

import { fetchOptions, listFamilies, listHouseholds, listResidents } from '@/lib/api';

import { EMPTY_SOURCES, type FormSources } from './sources';

/** Kung alin sa mga kaugnay na listahan ang kailangan ng isang form. */
export type SourceNeeds = {
  households?: boolean;
  families?: boolean;
  residents?: boolean;
};

/** Sapat na ang unang pahina para sa pagpili — hindi kayang i-scroll ang libo. */
const PICKER_PAGE_SIZE = 100;

type State = {
  sources: FormSources;
  loading: boolean;
  error: string | null;
};

/**
 * Kinukuha ang lahat ng kailangan ng form bago ito ipakita.
 *
 * Sabay-sabay ang mga request para iisang paghihintay lang — at kung mabigo
 * ang alinman, isang mensahe at isang "Try again" ang makikita, hindi form na
 * puro walang laman na dropdown.
 */
export function useFormSources(needs: SourceNeeds = {}) {
  const { households = false, families = false, residents = false } = needs;

  const [state, setState] = useState<State>({
    sources: EMPTY_SOURCES,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [optionsResult, householdList, familyList, residentList] = await Promise.all([
        fetchOptions(),
        households ? listHouseholds({ perPage: PICKER_PAGE_SIZE }) : null,
        families ? listFamilies({ perPage: PICKER_PAGE_SIZE }) : null,
        residents ? listResidents({ perPage: PICKER_PAGE_SIZE }) : null,
      ]);

      setState({
        loading: false,
        error: null,
        sources: {
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
        },
      });
    } catch (error) {
      setState({
        sources: EMPTY_SOURCES,
        loading: false,
        error: error instanceof Error ? error.message : 'Cannot load the form right now.',
      });
    }
  }, [households, families, residents]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
