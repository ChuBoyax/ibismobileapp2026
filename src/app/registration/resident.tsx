import { useMemo, useState } from 'react';

import { FormGate } from '@/components/form/form-gate';
import { FormWizard } from '@/components/form/form-wizard';
import type { FormValues } from '@/components/form/types';
import { RecordViewScreen } from '@/components/record-view-screen';
import { buildPayload } from '@/features/registration/build-payload';
import { buildValues } from '@/features/registration/build-values';
import { existingPhotos } from '@/features/registration/existing-photos';
import { residentSteps } from '@/features/registration/resident-form';
import { saveRecord } from '@/features/registration/save-record';
import { useFormSources } from '@/features/registration/use-form-sources';
import { useRecordForm } from '@/features/registration/use-record-form';

const SAVED = 'The resident is now in the barangay registry.';
const UPDATED = 'The changes are now in the barangay registry.';
const QUEUED = 'Saved on this device. It will be sent automatically once you are back online.';

export default function ResidentFormScreen() {
  const { sources, loading, error, reload } = useFormSources({
    households: true,
    families: true,
  });

  const form = useRecordForm('resident');
  const [message, setMessage] = useState(SAVED);

  const steps = useMemo(() => residentSteps(sources), [sources]);

  // Ang naka-queue nang sagot ang nauuna sa laman ng server: iyon ang huling
  // ipinasok ng gumagamit, at iyon ang inaasahan niyang makita pagbalik.
  const initialValues = useMemo<FormValues>(() => {
    if (form.draftValues) return form.draftValues;
    if (form.record) return buildValues(steps, form.record);

    return {};
  }, [form.draftValues, form.record, steps]);

  // Hiwalay sa mga sagot: ipinapakita lang ang mga dating litrato, hindi sila
  // kailanman ipinapadala pabalik. Tingnan ang existing-photos.
  const photos = useMemo(
    () => existingPhotos(steps, form.record, 'resident', form.recordId),
    [steps, form.record, form.recordId]
  );

  async function handleSubmit(values: FormValues) {
    const payload = buildPayload(steps, values);

    const result = await saveRecord({
      type: 'resident',
      uuid: form.uuid,
      label: [payload.first_name, payload.last_name].filter(Boolean).join(' ') || null,
      payload,
      formValues: values,
      recordId: form.recordId,
      expectedUpdatedAt: form.expectedUpdatedAt,
    });

    // Ang teknikal na dahilan ay nasa Sync queue — hindi dito. Ang kailangan
    // lang malaman ng user sa sandaling ito ay ligtas ang tala niya.
    setMessage(result.queued ? QUEUED : form.recordId ? UPDATED : SAVED);
  }

  const editing = !!form.recordId;
  const title = editing ? 'Edit resident' : form.mode === 'fix' ? 'Fix resident' : 'New resident';

  const viewTitle =
    [form.record?.first_name, form.record?.last_name]
      .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
      .join(' ') || 'Resident';

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
