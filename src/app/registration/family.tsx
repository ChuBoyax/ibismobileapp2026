import { useMemo, useState } from 'react';

import { FormGate } from '@/components/form/form-gate';
import { FormWizard } from '@/components/form/form-wizard';
import type { FormValues } from '@/components/form/types';
import { RecordViewScreen } from '@/components/record-view-screen';
import { buildPayload } from '@/features/registration/build-payload';
import { buildValues } from '@/features/registration/build-values';
import { existingPhotos } from '@/features/registration/existing-photos';
import { familySteps } from '@/features/registration/family-form';
import { saveRecord } from '@/features/registration/save-record';
import { useFormSources } from '@/features/registration/use-form-sources';
import { useRecordForm } from '@/features/registration/use-record-form';

const SAVED = 'The family is now in the barangay registry.';
const UPDATED = 'The changes are now in the barangay registry.';
const QUEUED = 'Saved on this device. It will be sent automatically once you are back online.';

export default function FamilyFormScreen() {
  const { sources, loading, error, reload } = useFormSources({
    residents: true,
    households: true,
  });

  const form = useRecordForm('family');
  const [message, setMessage] = useState(SAVED);

  const steps = useMemo(() => familySteps(sources), [sources]);

  const initialValues = useMemo<FormValues>(() => {
    if (form.draftValues) return form.draftValues;
    if (form.record) return buildValues(steps, form.record);

    return {};
  }, [form.draftValues, form.record, steps]);

  // Hiwalay sa mga sagot: ipinapakita lang ang mga dating litrato, hindi sila
  // kailanman ipinapadala pabalik. Tingnan ang existing-photos.
  const photos = useMemo(
    () => existingPhotos(steps, form.record, 'family', form.recordId),
    [steps, form.record, form.recordId]
  );

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

  const viewTitle =
    typeof form.record?.family_name === 'string' && form.record.family_name.trim()
      ? form.record.family_name
      : 'Family';

  return (
    <FormGate
      title={form.viewing ? viewTitle : title}
      loading={loading || form.loading}
      error={error || form.error}
      onRetry={() => {
        reload();
        form.reload();
      }}>
      {/* Buod muna kapag binuksan mula sa listahan. Ang stepper ay nasa likod
          ng pindutang "Edit" — tingnan ang useRecordForm. */}
      {form.viewing ? (
        <RecordViewScreen
          title={viewTitle}
          subtitle="Registry of Barangay Inhabitants"
          steps={steps}
          values={initialValues}
          existingPhotos={photos}
          editHref={form.editHref}
          pending={!!form.draftValues}
        />
      ) : (
        <FormWizard
          title={title}
          subtitle="Registry of Barangay Inhabitants"
          steps={steps}
          initialValues={initialValues}
          existingPhotos={photos}
          initialStep={form.initialStep}
          onSubmit={handleSubmit}
          successMessage={message}
        />
      )}
    </FormGate>
  );
}
