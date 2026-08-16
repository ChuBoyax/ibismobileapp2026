import { randomUUID } from 'expo-crypto';
import { useMemo } from 'react';

import { FormGate } from '@/components/form/form-gate';
import { FormWizard } from '@/components/form/form-wizard';
import type { FormValues } from '@/components/form/types';
import { buildPayload } from '@/features/registration/build-payload';
import { residentSteps } from '@/features/registration/resident-form';
import { useFormSources } from '@/features/registration/use-form-sources';
import { createResident } from '@/lib/api';

export default function NewResidentScreen() {
  const { sources, loading, error, reload } = useFormSources({
    households: true,
    families: true,
  });

  const steps = useMemo(() => residentSteps(sources), [sources]);

  // Iisang uuid sa buong buhay ng screen. Kapag na-timeout ang unang padala at
  // sinubukang muli, kikilalanin ito ng server bilang parehong tala imbes na
  // gumawa ng pangalawa.
  const uuid = useMemo(() => randomUUID(), []);

  async function handleSubmit(values: FormValues) {
    await createResident({ ...buildPayload(steps, values), uuid });
  }

  return (
    <FormGate title="New resident" loading={loading} error={error} onRetry={reload}>
      <FormWizard
        title="New resident"
        subtitle="Registry of Barangay Inhabitants"
        steps={steps}
        onSubmit={handleSubmit}
        successMessage="Naitala na ang residente sa RBI. Makikita na ito sa listahan at sa web."
      />
    </FormGate>
  );
}
