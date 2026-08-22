import type { FieldDef, StepDef } from '@/components/form/types';
import type { ApiUser } from '@/lib/api';


export function withBarangay(steps: StepDef[], profile: ApiUser | null): StepDef[] {
  const barangays = profile?.barangays ?? [];

  if (barangays.length < 2 || steps.length === 0) return steps;

  const field: FieldDef = {
    name: 'barangay_id',
    label: 'Barangay',
    type: 'select',
    icon: 'business-outline',
    placeholder: 'Choose a barangay',
    hint: 'Where this record will be filed. This cannot be changed later.',
    required: true,
    options: barangays.map((barangay) => ({
      value: String(barangay.id),
      label: barangay.name.trim(),
    })),
  };

  const [first, ...rest] = steps;
  const [firstSection, ...otherSections] = first.sections;

  return [
    {
      ...first,
      sections: [
        { ...firstSection, fields: [field, ...firstSection.fields] },
        ...otherSections,
      ],
    },
    ...rest,
  ];
}
