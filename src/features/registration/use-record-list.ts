import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Paginated } from '@/lib/api';
import { getCache, putCache } from '@/lib/db';

/** Hinihintay muna ang paghinto ng pagta-type bago magpadala ng request. */
const SEARCH_DEBOUNCE_MS = 350;

type Fetcher<T> = (params: { search?: string; perPage?: number }) => Promise<Paginated<T>>;

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
export function useRecordList<T>(fetcher: Fetcher<T>, cacheKey?: string) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  /** Naka-save na kopya ang ipinapakita — walang naabot na server. */
  const [offline, setOffline] = useState(false);

  // Iniiwasang ipakita ang sagot ng lumang request kapag nauna itong dumating
  // sa pinakabago — madalas ito mangyari sa mabagal na koneksyon.
  const requestId = useRef(0);

  const load = useCallback(
    async (term: string, mode: 'initial' | 'refresh') => {
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

      if (saved && id === requestId.current && mode === 'initial') {
        const matched = term
          ? saved.value.items.filter((item) => matchesTerm(item, term))
          : saved.value.items;

        setItems(matched);
        setTotal(term ? matched.length : saved.value.total);
        setOffline(true);
        setLoading(false);
      }

      try {
        const result = await fetcher({ search: term, perPage: 50 });

        if (id !== requestId.current) return;

        setItems(result.data);
        setTotal(result.meta.total);
        setOffline(false);

        // Ang walang hanap lang ang itinatabi — iyon ang buong listahan, at
        // iyon din ang sasalain kapag naghanap habang walang koneksyon.
        if (cacheKey && !term) {
          putCache(cacheKey, { items: result.data, total: result.meta.total });
        }
      } catch (err) {
        if (id !== requestId.current) return;

        // Hindi maabot ang server. Kung may naka-save, doon maghanap —
        // mas kapaki-pakinabang ang lumang listahan kaysa blangko.
        if (saved) {
          const matched = term
            ? saved.value.items.filter((item) => matchesTerm(item, term))
            : saved.value.items;

          setItems(matched);
          setTotal(term ? matched.length : saved.value.total);
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
    [fetcher, cacheKey]
  );

  useEffect(() => {
    const timer = setTimeout(() => load(search, 'initial'), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search, load]);

  const refresh = useCallback(() => load(search, 'refresh'), [load, search]);

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

  return { items, total, loading, refreshing, error, offline, search, setSearch, refresh };
}
