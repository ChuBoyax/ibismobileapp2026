import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Paginated } from '@/lib/api';

/** Hinihintay muna ang paghinto ng pagta-type bago magpadala ng request. */
const SEARCH_DEBOUNCE_MS = 350;

type Fetcher<T> = (params: { search?: string; perPage?: number }) => Promise<Paginated<T>>;

/**
 * Naghahatid ng laman ng mga tab na listahan.
 *
 * Sa server ginagawa ang paghahanap, hindi sa listahang nasa memorya — libo
 * ang residente ng isang barangay at unang pahina lang ang hawak ng app.
 */
export function useRecordList<T>(fetcher: Fetcher<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Iniiwasang ipakita ang sagot ng lumang request kapag nauna itong dumating
  // sa pinakabago — madalas ito mangyari sa mabagal na koneksyon.
  const requestId = useRef(0);

  const load = useCallback(
    async (term: string, mode: 'initial' | 'refresh') => {
      const id = ++requestId.current;

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const result = await fetcher({ search: term, perPage: 50 });

        if (id !== requestId.current) return;

        setItems(result.data);
        setTotal(result.meta.total);
      } catch (err) {
        if (id !== requestId.current) return;

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
    [fetcher]
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

  return { items, total, loading, refreshing, error, search, setSearch, refresh };
}
