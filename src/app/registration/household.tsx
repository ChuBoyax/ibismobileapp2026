import { useMemo, useState } from 'react';

import { FormGate } from '@/components/form/form-gate';
import { FormWizard } from '@/components/form/form-wizard';
import type { FormValues } from '@/components/form/types';
import { buildPayload } from '@/features/registration/build-payload';
import { buildValues } from '@/features/registration/build-values';
import { householdSteps } from '@/features/registration/household-form';
import { saveRecord } from '@/features/registration/save-record';
import { useFormSources } from '@/features/registration/use-form-sources';
import { useRecordForm } from '@/features/registration/use-record-form';

const SAVED = 'The household is now in the barangay registry.';
const UPDATED = 'The changes are now in the barangay registry.';
const QUEUED = 'Saved on this device. It will be sent automatically once you are back online.';

export default function HouseholdFormScreen() {
  const { sources, loading, error, reload } = useFormSources();

  const form = useRecordForm('household');
  const [message, setMessage] = useState(SAVED);

  const steps = useMemo(() => householdSteps(sources), [sources]);

  const initialValues = useMemo<FormValues>(() => {
    if (form.draftValues) return form.draftValues;
    if (form.record) return buildValues(steps, form.record);

    return {};
  }, [form.draftValues, form.record, steps]);

  async function handleSubmit(values: FormValues) {
    const payload = buildPayload(steps, values);

    const result = await saveRecord({
      type: 'household',
      uuid: form.uuid,
      label: (payload.house_number as string) || null,
      payload,
      formValues: values,
      recordId: form.recordId,
      expectedUpdatedAt: form.expectedUpdatedAt,
    });

    setMessage(result.queued ? QUEUED : form.recordId ? UPDATED : SAVED);
  }

  const editing = !!form.recordId;
  const title = editing ? 'Edit household' : form.mode === 'fix' ? 'Fix household' : 'New household';

  return (
    <FormGate
      title={title}
      loading={loading || form.loading}
      error={error || form.error}
      onRetry={() => {
        reload();
        form.reload();
      }}>
      <FormWizard
        title={title}
        subtitle="Registry of Barangay Inhabitants"
        steps={steps}
        initialValues={initialValues}
        onSubmit={handleSubmit}
        successMessage={message}
      />
    </FormGate>
  );
}
