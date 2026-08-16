import { useMemo, useState } from 'react';

import { FormGate } from '@/components/form/form-gate';
import { FormWizard } from '@/components/form/form-wizard';
import type { FormValues } from '@/components/form/types';
import { buildPayload } from '@/features/registration/build-payload';
import { householdSteps } from '@/features/registration/household-form';
import { saveRecord } from '@/features/registration/save-record';
import { useDraft } from '@/features/registration/use-draft';
import { useFormSources } from '@/features/registration/use-form-sources';

const SAVED = 'Naitala na ang sambahayan sa RBI. Makikita na ito sa listahan at sa web.';
const QUEUED =
  'Nakatabi na ang sambahayan sa cellphone mo. Kusa itong ipapadala kapag may koneksyon — hindi mo na kailangang ulitin.';

export default function NewHouseholdScreen() {
  const { sources, loading, error, reload } = useFormSources();

  const draft = useDraft();
  const [message, setMessage] = useState(SAVED);

  const steps = useMemo(() => householdSteps(sources), [sources]);

  async function handleSubmit(values: FormValues) {
    const payload = buildPayload(steps, values);

    const result = await saveRecord({
      type: 'household',
      uuid: draft.uuid,
      label: (payload.house_number as string) || null,
      payload,
      formValues: values,
    });

    setMessage(result.queued ? QUEUED : SAVED);
  }

  return (
    <FormGate
      title="New household"
      loading={loading || draft.loading}
      error={error}
      onRetry={reload}>
      <FormWizard
        title={draft.isDraft ? 'Fix household' : 'New household'}
        subtitle="Registry of Barangay Inhabitants"
        steps={steps}
        initialValues={draft.initialValues}
        onSubmit={handleSubmit}
        successMessage={message}
      />
    </FormGate>
  );
}
