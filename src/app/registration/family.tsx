import { randomUUID } from 'expo-crypto';
import { useMemo } from 'react';

import { FormGate } from '@/components/form/form-gate';
import { FormWizard } from '@/components/form/form-wizard';
import type { FormValues } from '@/components/form/types';
import { buildPayload } from '@/features/registration/build-payload';
import { familySteps } from '@/features/registration/family-form';
import { useFormSources } from '@/features/registration/use-form-sources';
import { createFamily } from '@/lib/api';

export default function NewFamilyScreen() {
  const { sources, loading, error, reload } = useFormSources({
    residents: true,
    households: true,
  });

  const steps = useMemo(() => familySteps(sources), [sources]);
  const uuid = useMemo(() => randomUUID(), []);

  async function handleSubmit(values: FormValues) {
    await createFamily({ ...buildPayload(steps, values), uuid });
  }

  return (
    <FormGate title="New family" loading={loading} error={error} onRetry={reload}>
      <FormWizard
        title="New family"
        subtitle="Registry of Barangay Inhabitants"
        steps={steps}
        onSubmit={handleSubmit}
        successMessage="Naitala na ang pamilya sa RBI. Makikita na ito sa listahan at sa web."
      />
    </FormGate>
  );
}
