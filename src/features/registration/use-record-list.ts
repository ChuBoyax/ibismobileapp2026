import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Paginated } from '@/lib/api';
import { getCache, putCache } from '@/lib/db';

/** Hinihintay muna ang paghinto ng pagta-type bago magpadala ng request. */
const SEARCH_DEBOUNCE_MS = 350;

type Fetcher<T> = (params: { search?: string; perPage?: number }) => Promise<Paginated<T>>;

/**
 * Naghahatid ng laman ng mga tab na listahan.
 *
 * Sa server ginagawa ang paghahanap, hindi sa listahang nasa memorya — libo
 * ang residente ng isang barangay at unang pahina lang ang hawak ng app.
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

      // Naka-save muna, saka pagsasariwa. Ang naka-imbak ay ang buong
      // listahan lang — walang saysay itabi ang resulta ng paghahanap.
      if (cacheKey && !term && mode === 'initial') {
        const saved = await getCache<{ items: T[]; total: number }>(cacheKey);

        if (saved && id === requestId.current) {
          setItems(saved.value.items);
          setTotal(saved.value.total);
          setOffline(true);
          setLoading(false);
        }
      }

      try {
        const result = await fetcher({ search: term, perPage: 50 });

        if (id !== requestId.current) return;

        setItems(result.data);
        setTotal(result.meta.total);
        setOffline(false);

        if (cacheKey && !term) {
          putCache(cacheKey, { items: result.data, total: result.meta.total });
        }
      } catch (err) {
        if (id !== requestId.current) return;

        // Kung may naipakita nang naka-save, huwag itong burahin at palitan
        // ng error — mas kapaki-pakinabang ang lumang listahan kaysa blangko.
        const saved =
          cacheKey && !term ? await getCache<{ items: T[]; total: number }>(cacheKey) : null;

        if (saved && id === requestId.current) {
          setItems(saved.value.items);
          setTotal(saved.value.total);
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
