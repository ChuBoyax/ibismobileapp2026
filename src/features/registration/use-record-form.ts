import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { FormValues } from '@/components/form/types';
import { showFamily, showHousehold, showResident, type FullRecord } from '@/lib/api';
import { getCache, putCache, recordCacheKey } from '@/lib/db';
import { resolveFormValues } from '@/lib/local-refs';
import { findByRecord, get, type OutboxType } from '@/lib/outbox';

const SHOW = {
  resident: showResident,
  household: showHousehold,
  family: showFamily,
} as const;

export type RecordFormMode =
 
  | 'create'
 
  | 'edit'
 
  | 'fix';


export function useRecordForm(type: OutboxType) {
  const params = useLocalSearchParams<{
    draft?: string;
    id?: string;
    edit?: string;
    step?: string;
  }>();

  const draftUuid = typeof params.draft === 'string' ? params.draft : null;
  const wantsEdit = params.edit === '1';
  const paramId = typeof params.id === 'string' ? Number(params.id) : NaN;
  const routeRecordId = Number.isFinite(paramId) && paramId > 0 ? paramId : null;

  const freshUuid = useMemo(() => randomUUID(), []);


  const [queuedUuid, setQueuedUuid] = useState<string | null>(null);

  const [draftValues, setDraftValues] = useState<FormValues | null>(null);
  const [record, setRecord] = useState<FullRecord | null>(null);
  const [recordId, setRecordId] = useState<number | null>(routeRecordId);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!draftUuid || !!routeRecordId);
 
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    if (!draftUuid && !routeRecordId) return;

   
    void (async () => {
      let targetId = routeRecordId;

     
      const item = draftUuid
        ? await get(draftUuid).catch(() => null)
        : routeRecordId
          ? await findByRecord(type, routeRecordId)
          : null;

      if (!active) return;

      if (item) {
        
        const values = (await resolveFormValues(item.formValues)) as FormValues;

        if (!active) return;

        setDraftValues(values);
        setExpectedUpdatedAt(item.expectedUpdatedAt);
        setQueuedUuid(item.uuid);

        if (item.recordId) {
          targetId = item.recordId;
          setRecordId(item.recordId);
        }
      }

     
      if (targetId) {
        const key = recordCacheKey(type, targetId);

      
        const keepVersion = !!item?.expectedUpdatedAt;

       
        const saved = await getCache<FullRecord>(key);

        if (!active) return;

        if (saved) {
          setRecord(saved.value);

       
          if (!keepVersion) {
            setExpectedUpdatedAt(
              typeof saved.value.updated_at === 'string' ? saved.value.updated_at : null
            );
          }

        
          setLoading(false);
        }

        try {
          const { data } = await SHOW[type](targetId);
          if (!active) return;

         
          void putCache(key, data);

        
          if (!saved) {
            setRecord(data);

            if (!keepVersion) {
              setExpectedUpdatedAt(typeof data.updated_at === 'string' ? data.updated_at : null);
            }
          }
        } catch {
          if (!active) return;

         
          if (!saved && !draftUuid) {
            setError(
              'This record has not been opened on this device yet. Connect to the server to open it.'
            );
          }
        }
      }

      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [draftUuid, routeRecordId, type, attempt]);

  const reload = useCallback(() => {
    setLoading(true);
    setError('');
    setAttempt((value) => value + 1);
  }, []);

  const mode: RecordFormMode = draftUuid ? 'fix' : routeRecordId ? 'edit' : 'create';

 
  const viewing = mode === 'edit' && !wantsEdit;

 
  const firstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
       
        firstFocus.current = false;
        return;
      }

      if (viewing) setAttempt((value) => value + 1);
    }, [viewing])
  );

  return {
   
    viewing,
    
    editHref: (step?: number) =>
      `/registration/${type}?id=${routeRecordId ?? recordId}&edit=1` +
      (step === undefined ? '' : `&step=${step}`),
   
    initialStep: Number.isFinite(Number(params.step)) ? Math.max(0, Number(params.step)) : 0,
   
    uuid: draftUuid ?? queuedUuid ?? freshUuid,
    mode,
   
    record,
    
    draftValues,
    recordId,
    expectedUpdatedAt,
    loading,
    error,
    reload,
  };
}
