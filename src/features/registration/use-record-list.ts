import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { FullListPage, ListFilters } from '@/lib/api';
import { backfillRecords } from './backfill-records';
import { getCache, putCache, recordCacheKey } from '@/lib/db';
import type { OutboxType } from '@/lib/outbox';

/** Hinihintay muna ang paghinto ng pagta-type bago magpadala ng request. */
const SEARCH_DEBOUNCE_MS = 350;

type Fetcher<T> = (params: {
  search?: string;
  perPage?: number;
  filters?: ListFilters;
}) => Promise<FullListPage<T>>;

/**
 * Paano masasala ang isang tala kapag walang koneksyon.
 *
 * Ang bawat modulo ang nakakaalam ng sariling hugis — alin ang purok ng
 * sambahayan, alin ang sektor ng residente — kaya doon ito isinusulat, hindi
 * dito. Mahaba man nang kaunti, mababasa: nakikita mo ang eksaktong panuntunan
 * sa tabi ng chip na naglalabas nito.
 */
export type FilterMatcher<T> = (item: T, filters: ListFilters) => boolean;

/**
 * Tinutugma ang hinahanap sa lahat ng teksto ng isang tala.
 *
 * Ginagamit lang ito kapag hindi maabot ang server. Malawak ang saklaw —
 * pangalan, purok, civil status, anumang salita sa tala — kaya kahit anong
 * naaalala ng user ay may pag-asang tumama. Sa hindi tiyak na paghahanap,
 * mas mabuting sobra kaysa kulang.
 */
function matchesTerm(item: unknown, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;

  function walk(value: unknown): boolean {
    if (typeof value === 'string') return value.toLowerCase().includes(needle);
    if (typeof value === 'number') return String(value).includes(needle);
    if (Array.isArray(value)) return value.some(walk);

    if (value !== null && typeof value === 'object') {
      return Object.values(value as Record<string, unknown>).some(walk);
    }

    return false;
  }

  return walk(item);
}

/**
 * Naghahatid ng laman ng mga tab na listahan.
 *
 * SA SERVER ANG PAGHAHANAP KAPAG MAY KONEKSYON — libo ang residente ng isang
 * barangay at unang pahina lang ang hawak ng app, kaya doon lang makikita
 * ang lahat.
 *
 * KAPAG WALANG KONEKSYON, sa naka-save na listahan naghahanap. Limitado ito
 * sa huling nakuhang mga tala, pero malaking pagkakaiba pa rin: ang
 * enumerator sa bundok na naghahanap ng pangalang kanina lang niya nakita ay
 * mahahanap niya ito, imbes na blangkong screen.
 */
export function useRecordList<T>(
  fetcher: Fetcher<T>,
  cacheKey?: string,
  recordType?: OutboxType,
  matchFilters?: FilterMatcher<T>
) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ListFilters>({});
  /** Naka-save na kopya ang ipinapakita — walang naabot na server. */
  const [offline, setOffline] = useState(false);

  // Iniiwasang ipakita ang sagot ng lumang request kapag nauna itong dumating
  // sa pinakabago — madalas ito mangyari sa mabagal na koneksyon.
  const requestId = useRef(0);

  const load = useCallback(
    async (term: string, active: ListFilters, mode: 'initial' | 'refresh') => {
      const id = ++requestId.current;

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);

      // NAKA-SAVE MUNA, KAHIT MAY HINAHANAP.
      //
      // Ang naka-imbak ay ang buong listahan, kaya kaya nating salain ito
      // dito mismo. Dalawa ang napapala: agad may lumalabas habang naghihintay
      // ng server, at may resulta pa rin kahit walang koneksyon.
      const saved = cacheKey ? await getCache<{ items: T[]; total: number }>(cacheKey) : null;

      const sift = (items: T[]) => {
        const byTerm = term ? items.filter((item) => matchesTerm(item, term)) : items;

        return matchFilters ? byTerm.filter((item) => matchFilters(item, active)) : byTerm;
      };

      const narrowed = term !== '' || Object.values(active).some((value) => value != null);

      if (saved && id === requestId.current && mode === 'initial') {
        const matched = sift(saved.value.items);

        setItems(matched);
        setTotal(narrowed ? matched.length : saved.value.total);
        setOffline(true);
        setLoading(false);
      }

      try {
        const result = await fetcher({ search: term, perPage: 50, filters: active });

        if (id !== requestId.current) return;

        setItems(result.data);
        setTotal(result.meta.total);
        setOffline(false);

        // Ang walang hanap lang ang itinatabi — iyon ang buong listahan, at
        // iyon din ang sasalain kapag naghanap habang walang koneksyon.
        if (cacheKey && !narrowed) {
          putCache(cacheKey, { items: result.data, total: result.meta.total });
        }

        // ANG BUONG LAMAN NG BAWAT TALA, HINDI LANG ANG BUOD.
        //
        // Ang card ay kayang buuin sa buod, pero ang form ay hindi. Kung ang
        // buong tala ay kukunin lang sa sandaling pindutin ito, ang pag-edit
        // sa lugar na walang signal ay mabibigo — at doon mismo ito
        // pinakakailangan. Kaya sa bawat pagbukas ng listahan habang may
        // koneksyon, naitatabi na ang lahat: pagsapit ng oras na wala nang
        // signal, kahit alin sa mga nakikita ay mabubuksan at maaayos.
        if (recordType && result.records) {
          for (const record of result.records) {
            if (typeof record.id === 'number') {
              putCache(recordCacheKey(recordType, record.id), record);
            }
          }
        } else if (recordType) {
          /*
            WALANG IBINIGAY NA BUONG TALA ANG SERVER.

            Nangyayari ito kapag mas luma ang naka-deploy kaysa sa app —
            tahimik nitong binabalewala ang hiling na "full=1". Ang listahan
            ay gumagana pa rin, kaya walang senyas na may mali; sa bundok lang
            ito lalabas, kung saan huli na ang lahat.

            Kaya tayo na ang kukuha, isa-isa at sa likod. Tingnan ang
            backfillRecords para sa mga pagpipigil.
          */
          const ids = result.data
            .map((item) => (item as { id?: unknown }).id)
            .filter((value): value is number => typeof value === 'number');

          void backfillRecords(recordType, ids);
        }
      } catch (err) {
        if (id !== requestId.current) return;

        // Hindi maabot ang server. Kung may naka-save, doon maghanap —
        // mas kapaki-pakinabang ang lumang listahan kaysa blangko.
        if (saved) {
          const matched = sift(saved.value.items);

          setItems(matched);
          setTotal(narrowed ? matched.length : saved.value.total);
          setOffline(true);
          return;
        }

        setError(err instanceof Error ? err.message : 'Cannot load the records.');
        setItems([]);
        setTotal(0);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fetcher, cacheKey, recordType, matchFilters]
  );

  useEffect(() => {
    const timer = setTimeout(() => load(search, filters, 'initial'), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search, filters, load]);

  const refresh = useCallback(
    () => load(search, filters, 'refresh'),
    [load, search, filters]
  );

  const setFilter = useCallback((key: string, value: string | number | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => setFilters({}), []);

  // Kapag bumalik dito mula sa registration form, may bago nang tala na hindi
  // pa kasama sa hawak ng screen. Kinukuha itong muli sa bawat pagbalik ng
  // pokus — nakakalito kung ang katatapos lang itala ay wala sa listahan.
  const firstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        // Hinahayaan ang mount effect na siyang unang kumuha, para hindi
        // doble ang request sa pagbukas ng tab.
        firstFocus.current = false;
        return;
      }

      refresh();
    }, [refresh])
  );

  return {
    items,
    total,
    loading,
    refreshing,
    error,
    offline,
    search,
    setSearch,
    filters,
    setFilter,
    clearFilters,
    refresh,
  };
}
