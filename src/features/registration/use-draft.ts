import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import type { FormValues } from '@/components/form/types';
import { get, type OutboxItem } from '@/lib/outbox';

/**
 * Hinahawakan ang uuid at ang dating sagot ng isang registration form.
 *
 * Dalawang sitwasyon ang pinagsisilbihan:
 *
 *  • BAGONG TALA — bagong uuid, walang paunang sagot. Iisa ang uuid sa buong
 *    buhay ng screen, kaya kung na-timeout ang unang padala at sinubukang
 *    muli, kikilalanin ito ng server bilang parehong tala.
 *
 *  • PAG-AAYOS — may `?draft=<uuid>` sa ruta. Kinukuha ang naka-queue na tala,
 *    ibinabalik ang dating sagot sa form, at GINAGAMIT ANG PAREHONG UUID.
 *    Mahalaga iyon: kung nakapasok na pala ang unang padala at hindi lang
 *    nakarating ang sagot, hindi ito magdodoble.
 */
export function useDraft() {
  const params = useLocalSearchParams<{ draft?: string }>();
  const draftUuid = typeof params.draft === 'string' ? params.draft : null;

  const [draft, setDraft] = useState<OutboxItem | null>(null);
  const [loading, setLoading] = useState(!!draftUuid);

  const freshUuid = useMemo(() => randomUUID(), []);

  useEffect(() => {
    let active = true;

    // Walang dapat hintayin kapag bagong tala — `false` na ang paunang halaga
    // ng loading, kaya walang setState na kailangan dito.
    if (!draftUuid) return;

    get(draftUuid)
      .then((item) => {
        if (active) setDraft(item);
      })
      .catch(() => {
        if (active) setDraft(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [draftUuid]);

  return {
    uuid: draftUuid ?? freshUuid,
    initialValues: (draft?.formValues ?? {}) as FormValues,
    /** True habang hinihintay ang naka-queue na tala mula sa SQLite. */
    loading,
    isDraft: !!draftUuid,
  };
}
