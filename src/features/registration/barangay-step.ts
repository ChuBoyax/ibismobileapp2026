import type { FieldDef, StepDef } from '@/components/form/types';
import type { ApiUser } from '@/lib/api';

/**
 * Isinisingit ang tanong na "aling barangay?" sa simula ng form.
 *
 * BAKIT KAILANGAN. Ang bagong tala ay dapat malaman kung saang barangay ito
 * ihahain, at walang makakasagot niyan kundi ang tao. Sa may iisang barangay,
 * alam na ito ng server at hindi na nagtatanong. Pero ang tagapangasiwa ng
 * bayan ay may apat — at kapag hindi siya tinanong, tatanggihan ng server ang
 * pag-save na may "Please choose which barangay this record belongs to",
 * PAGKATAPOS niyang punan ang labing-isang hakbang. Doon mismo mawawala ang
 * mahabang trabaho.
 *
 * Kaya itinatanong ito sa UMPISA, hindi sa dulo: ang tanong na humaharang sa
 * pag-save ay dapat ang una, hindi ang huli.
 *
 * SA MAY IISANG BARANGAY, WALANG IDINARAGDAG. Ang dropdown na iisa lang ang
 * laman ay hindi tanong kundi hadlang.
 */
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
