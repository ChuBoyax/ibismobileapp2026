import { useMemo, useState } from 'react';

import { FormGate } from '@/components/form/form-gate';
import { FormWizard } from '@/components/form/form-wizard';
import type { FormValues } from '@/components/form/types';
import { buildPayload } from '@/features/registration/build-payload';
import { familySteps } from '@/features/registration/family-form';
import { saveRecord } from '@/features/registration/save-record';
import { useDraft } from '@/features/registration/use-draft';
import { useFormSources } from '@/features/registration/use-form-sources';

const SAVED = 'The family is now in the barangay registry.';
const QUEUED = 'Saved on this device. It will be sent automatically once you are back online.';

export default function NewFamilyScreen() {
  const { sources, loading, error, reload } = useFormSources({
    residents: true,
    households: true,
  });

  const draft = useDraft();
  const [message, setMessage] = useState(SAVED);

  const steps = useMemo(() => familySteps(sources), [sources]);

  async function handleSubmit(values: FormValues) {
    const payload = buildPayload(steps, values);

    const result = await saveRecord({
      type: 'family',
      uuid: draft.uuid,
      label: (payload.family_name as string) || null,
      payload,
      formValues: values,
    });

    setMessage(result.queued ? QUEUED : SAVED);
  }

  return (
    <FormGate
      title="New family"
      loading={loading || draft.loading}
      error={error}
      onRetry={reload}>
      <FormWizard
        title={draft.isDraft ? 'Fix family' : 'New family'}
        subtitle="Registry of Barangay Inhabitants"
        steps={steps}
        initialValues={draft.initialValues}
        onSubmit={handleSubmit}
        successMessage={message}
      />
    </FormGate>
  );
}
