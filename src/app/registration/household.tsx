import { randomUUID } from 'expo-crypto';
import { useMemo } from 'react';

import { FormGate } from '@/components/form/form-gate';
import { FormWizard } from '@/components/form/form-wizard';
import type { FormValues } from '@/components/form/types';
import { buildPayload } from '@/features/registration/build-payload';
import { householdSteps } from '@/features/registration/household-form';
import { useFormSources } from '@/features/registration/use-form-sources';
import { createHousehold } from '@/lib/api';

export default function NewHouseholdScreen() {
  const { sources, loading, error, reload } = useFormSources();

  const steps = useMemo(() => householdSteps(sources), [sources]);
  const uuid = useMemo(() => randomUUID(), []);

  async function handleSubmit(values: FormValues) {
    await createHousehold({ ...buildPayload(steps, values), uuid });
  }

  return (
    <FormGate title="New household" loading={loading} error={error} onRetry={reload}>
      <FormWizard
        title="New household"
        subtitle="Registry of Barangay Inhabitants"
        steps={steps}
        onSubmit={handleSubmit}
        successMessage="Naitala na ang sambahayan sa RBI. Makikita na ito sa listahan at sa web."
      />
    </FormGate>
  );
}
