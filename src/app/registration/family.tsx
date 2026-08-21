import { useMemo, useState } from 'react';

import { FormGate } from '@/components/form/form-gate';
import { FormWizard } from '@/components/form/form-wizard';
import type { FormValues } from '@/components/form/types';
import { buildPayload } from '@/features/registration/build-payload';
import { buildValues } from '@/features/registration/build-values';
import { familySteps } from '@/features/registration/family-form';
import { saveRecord } from '@/features/registration/save-record';
import { withBarangay } from '@/features/registration/barangay-step';
import { useFormSources } from '@/features/registration/use-form-sources';
import { useRecordForm } from '@/features/registration/use-record-form';
import { useProfile } from '@/lib/use-profile';

const SAVED = 'The family is now in the barangay registry.';
const UPDATED = 'The changes are now in the barangay registry.';
const QUEUED = 'Saved on this device. It will be sent automatically once you are back online.';

export default function FamilyFormScreen() {
  const { sources, loading, error, reload } = useFormSources({
    residents: true,
    households: true,
  });

  const profile = useProfile();
  const form = useRecordForm('family');
  const [message, setMessage] = useState(SAVED);

  // Ang tanong na "aling barangay" ay idinaragdag lang kapag may pagpipilian.
  // Tingnan ang withBarangay para sa dahilan kung bakit nasa umpisa ito.
  const steps = useMemo(() => withBarangay(familySteps(sources), profile), [sources, profile]);

  const initialValues = useMemo<FormValues>(() => {
    if (form.draftValues) return form.draftValues;
    if (form.record) return buildValues(steps, form.record);

    return {};
  }, [form.draftValues, form.record, steps]);

  async function handleSubmit(values: FormValues) {
    const payload = buildPayload(steps, values);

    const result = await saveRecord({
      type: 'family',
      uuid: form.uuid,
      label: (payload.family_name as string) || null,
      payload,
      formValues: values,
      recordId: form.recordId,
      expectedUpdatedAt: form.expectedUpdatedAt,
    });

    setMessage(result.queued ? QUEUED : form.recordId ? UPDATED : SAVED);
  }

  const editing = !!form.recordId;
  const title = editing ? 'Edit family' : form.mode === 'fix' ? 'Fix family' : 'New family';

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
