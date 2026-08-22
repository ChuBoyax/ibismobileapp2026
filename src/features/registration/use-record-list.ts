import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { FullListPage, ListFilters } from '@/lib/api';
import { backfillRecords } from './backfill-records';
import { getCache, putCache, recordCacheKey } from '@/lib/db';
import type { OutboxType } from '@/lib/outbox';


const SEARCH_DEBOUNCE_MS = 350;

type Fetcher<T> = (params: {
  search?: string;
  perPage?: number;
  filters?: ListFilters;
}) => Promise<FullListPage<T>>;


export type FilterMatcher<T> = (item: T, filters: ListFilters) => boolean;


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
 
  const [offline, setOffline] = useState(false);


  const requestId = useRef(0);

  const load = useCallback(
    async (term: string, active: ListFilters, mode: 'initial' | 'refresh') => {
      const id = ++requestId.current;

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);

    
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

      
        if (cacheKey && !narrowed) {
          putCache(cacheKey, { items: result.data, total: result.meta.total });
        }

       
        if (recordType && result.records) {
          for (const record of result.records) {
            if (typeof record.id === 'number') {
              putCache(recordCacheKey(recordType, record.id), record);
            }
          }
        } else if (recordType) {
         
          const ids = result.data
            .map((item) => (item as { id?: unknown }).id)
            .filter((value): value is number => typeof value === 'number');

          void backfillRecords(recordType, ids);
        }
      } catch (err) {
        if (id !== requestId.current) return;

       
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


  const firstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
       
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
