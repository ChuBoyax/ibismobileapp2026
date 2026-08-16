import { useMemo, useState } from 'react';

import { FormGate } from '@/components/form/form-gate';
import { FormWizard } from '@/components/form/form-wizard';
import type { FormValues } from '@/components/form/types';
import { buildPayload } from '@/features/registration/build-payload';
import { residentSteps } from '@/features/registration/resident-form';
import { saveRecord } from '@/features/registration/save-record';
import { useDraft } from '@/features/registration/use-draft';
import { useFormSources } from '@/features/registration/use-form-sources';

const SAVED = 'The resident is now in the barangay registry.';
const QUEUED = 'Saved on this device. It will be sent automatically once you are back online.';

export default function NewResidentScreen() {
  const { sources, loading, error, reload } = useFormSources({
    households: true,
    families: true,
  });

  const draft = useDraft();
  const [message, setMessage] = useState(SAVED);

  const steps = useMemo(() => residentSteps(sources), [sources]);

  async function handleSubmit(values: FormValues) {
    const payload = buildPayload(steps, values);

    const result = await saveRecord({
      type: 'resident',
      uuid: draft.uuid,
      label: [payload.first_name, payload.last_name].filter(Boolean).join(' ') || null,
      payload,
      formValues: values,
    });

    // Ang teknikal na dahilan ay nasa Sync queue — hindi dito. Ang kailangan
    // lang malaman ng user sa sandaling ito ay ligtas ang tala niya.
    setMessage(result.queued ? QUEUED : SAVED);
  }

  return (
    <FormGate
      title="New resident"
      loading={loading || draft.loading}
      error={error}
      onRetry={reload}>
      <FormWizard
        title={draft.isDraft ? 'Fix resident' : 'New resident'}
        subtitle="Registry of Barangay Inhabitants"
        steps={steps}
        initialValues={draft.initialValues}
        onSubmit={handleSubmit}
        successMessage={message}
      />
    </FormGate>
  );
}
