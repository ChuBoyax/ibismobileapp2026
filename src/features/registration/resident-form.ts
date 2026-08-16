import type { FieldDef, FormValues, StepDef } from '@/components/form/types';

import { byId, byName } from './options';
import type { FormSources } from './sources';

/**
 * Talatanungan para sa isang residente, kasunod ng ResidentForm.php ng RBI web.
 *
 * Ang web ang batayan dito, hindi ang mga column ng talahanayan: may mga field
 * doon na hindi nakikita sa schema (ang bakuna at edukasyon ay hiwalay na tala)
 * at may mga panuntunan na hindi mahuhulaan sa database (ang edad ang nagtatakda
 * ng voting eligibility). Hinati sa mga hakbang dahil isang mahabang pahina ang
 * web at hindi iyon kayang buhatin ng isang cellphone.
 */

/** Ipinapasa ng web ang mga literal na ito, hindi id ng option. */
const PWD_REGISTRATION = literal(['Registered', 'Not Registered']);
const SOLO_PARENT_REGISTRATION = literal(['Registered', 'Not Registered', 'Processing']);
const SOCIAL_PENSION = literal(['Has Social Pension Number', 'Processing', 'Not Qualified']);
const VACCINATION_TYPES = [
  { value: 'adult', label: 'Adult Vaccination' },
  { value: 'child', label: 'Child Vaccination' },
];

function literal(values: readonly string[]) {
  return values.map((value) => ({ value, label: value }));
}

/** Edad mula sa MM/DD/YYYY. Ito ang batayan ng voting eligibility. */
function ageFrom(values: FormValues): number | null {
  const raw = values.date_of_birth;

  if (typeof raw !== 'string') return null;

  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return null;

  const [, month, day, year] = match;
  const birth = new Date(Number(year), Number(month) - 1, Number(day));
  const now = new Date();

  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());

  if (beforeBirthday) age -= 1;

  return age >= 0 ? age : null;
}

/** Pangalan ng option mula sa id — ginagamit ng mga kondisyon sa status. */
const labelOf = (options: FormSources['options'], category: string, value: unknown) =>
  typeof value === 'string'
    ? (options[category]?.find((option) => String(option.id) === value)?.name ?? null)
    : null;

export function residentSteps({ options, households, families, residents }: FormSources): StepDef[] {
  const statusIs = (name: string) => (v: FormValues) => labelOf(options, 'status', v.status_id) === name;

  return [
    {
      id: 'basic',
      title: 'Basic information',
      shortTitle: 'Basic',
      icon: 'person-outline',
      sections: [
        {
          title: 'Full name',
          description: 'Isulat ang pangalan ayon sa birth certificate.',
          icon: 'id-card-outline',
          fields: [
            {
              name: 'last_name',
              label: 'Last name',
              type: 'text',
              icon: 'person-outline',
              autoCapitalize: 'words',
              required: true,
            },
            {
              name: 'first_name',
              label: 'First name',
              type: 'text',
              icon: 'person-outline',
              autoCapitalize: 'words',
              required: true,
            },
            {
              name: 'middle_name',
              label: 'Middle name',
              type: 'text',
              icon: 'person-outline',
              autoCapitalize: 'words',
            },
            { name: 'suffix_id', label: 'Suffix', type: 'select', options: byId(options, 'suffix') },
          ],
        },
        {
          title: 'Birth and status',
          icon: 'calendar-outline',
          fields: [
            {
              name: 'sex',
              label: 'Sex',
              type: 'segmented',
              options: literal(['Male', 'Female']),
              required: true,
            },
            {
              name: 'date_of_birth',
              label: 'Date of birth',
              type: 'date',
              required: true,
              notFuture: true,
            },
            {
              // Sinusundan lang nito ang petsa ng kapanganakan gaya ng web,
              // kaya nakasara ito sa pag-edit at hindi ipinapadala sa server.
              name: 'age_display',
              label: 'Age',
              type: 'computed',
              icon: 'hourglass-outline',
              compute: (v) => {
                const age = ageFrom(v);
                return age === null ? '' : String(age);
              },
            },
            {
              name: 'place_of_birth',
              label: 'Place of birth',
              type: 'text',
              icon: 'location-outline',
              autoCapitalize: 'words',
              required: true,
            },
            {
              name: 'civil_status_id',
              label: 'Civil status',
              type: 'select',
              options: byId(options, 'civil_status'),
              required: true,
            },
            {
              // Maramihan ito sa web at array ang naiimbak sa database.
              name: 'citizenship',
              label: 'Citizenship',
              type: 'multiselect',
              options: byId(options, 'citizenship'),
              required: true,
            },
            {
              name: 'blood_type_id',
              label: 'Blood type',
              type: 'select',
              options: byId(options, 'blood_type'),
            },
          ],
        },
        {
          title: 'Livelihood',
          icon: 'briefcase-outline',
          fields: [
            {
              name: 'occupation',
              label: 'Occupation',
              type: 'text',
              icon: 'briefcase-outline',
              autoCapitalize: 'words',
            },
            {
              name: 'employment_status_id',
              label: 'Employment status',
              type: 'select',
              options: byId(options, 'employment_status'),
            },
          ],
        },
        {
          title: 'Address',
          description: 'Opsyonal lahat — magkakaiba ang paghahati ng bawat barangay.',
          icon: 'map-outline',
          fields: [
            { name: 'sitio_id', label: 'Sitio', type: 'select', options: byId(options, 'sitio') },
            { name: 'street_id', label: 'Street', type: 'select', options: byId(options, 'street') },
            { name: 'zone_id', label: 'Zone', type: 'select', options: byId(options, 'zone') },
            { name: 'purok_id', label: 'Purok', type: 'select', options: byId(options, 'purok') },
          ],
        },
        {
          title: 'Religion',
          description: 'Relihiyong kinaaaniban ng residente.',
          icon: 'book-outline',
          fields: [
            {
              name: 'religion_id',
              label: 'Denomination',
              type: 'select',
              placeholder: 'Search denomination…',
              options: byId(options, 'religion'),
            },
          ],
        },
      ],
    },

    {
      id: 'contact',
      title: 'Contact information',
      shortTitle: 'Contact',
      icon: 'call-outline',
      sections: [
        {
          title: 'Personal contact',
          icon: 'phone-portrait-outline',
          fields: [
            {
              // Labing-isang digit ang hinahanap ng web at doon din ipinapakita
              // ang "too short / too long" habang nagta-type.
              name: 'contact_number',
              label: 'Contact number',
              type: 'text',
              icon: 'call-outline',
              placeholder: '09171234567',
              digitsOnly: true,
              exactLength: 11,
            },
            {
              name: 'email',
              label: 'Email',
              type: 'text',
              icon: 'mail-outline',
              keyboardType: 'email-address',
              autoCapitalize: 'none',
              email: true,
            },
          ],
        },
        {
          title: 'Emergency contact',
          icon: 'medkit-outline',
          fields: [
            {
              name: 'emergency_contact_person',
              label: 'Emergency contact person',
              type: 'text',
              icon: 'person-outline',
              autoCapitalize: 'words',
            },
            {
              name: 'emergency_contact_number',
              label: 'Emergency contact number',
              type: 'text',
              icon: 'call-outline',
              placeholder: '09171234567',
              digitsOnly: true,
              exactLength: 11,
            },
            {
              name: 'relationship_contact_id',
              label: 'Relationship to contact person',
              type: 'select',
              options: byId(options, 'relationship_contact'),
              required: true,
            },
          ],
        },
      ],
    },

    {
      id: 'photos',
      title: 'Photos',
      shortTitle: 'Photos',
      icon: 'camera-outline',
      sections: [
        {
          title: 'Photos',
          description: 'Upload photos of the resident.',
          icon: 'camera-outline',
          fields: [
            { name: 'resident_photo', label: 'Resident Photo', type: 'image' },
            { name: 'national_id_front', label: 'National ID (Front)', type: 'image' },
            { name: 'national_id_back', label: 'National ID (Back)', type: 'image' },
          ],
        },
      ],
    },

    {
      id: 'status',
      title: 'Status & migration',
      shortTitle: 'Status',
      icon: 'flag-outline',
      sections: [
        {
          title: 'Status & migration',
          description: 'Status and migration details of the resident.',
          icon: 'flag-outline',
          fields: [
            {
              name: 'status_id',
              label: 'Status',
              type: 'select',
              options: byId(options, 'status'),
              required: true,
            },
            {
              name: 'date_of_death',
              label: 'Date of death',
              type: 'date',
              notFuture: true,
              visibleWhen: statusIs('Deceased'),
            },
            {
              name: 'death_certificate_photo',
              label: 'Death Certificate Photo',
              type: 'image',
              visibleWhen: statusIs('Deceased'),
            },
            {
              name: 'date_of_migration',
              label: 'Date of migration',
              type: 'date',
              visibleWhen: statusIs('Migrated'),
            },
            {
              name: 'place_to_migrate',
              label: 'Place to migrate',
              type: 'text',
              icon: 'airplane-outline',
              autoCapitalize: 'words',
              visibleWhen: statusIs('Migrated'),
            },
          ],
        },
      ],
    },

    {
      id: 'education',
      title: 'Education',
      shortTitle: 'Education',
      icon: 'school-outline',
      sections: [
        {
          title: 'Education',
          description: 'Maaaring higit sa isa ang naitalang antas.',
          icon: 'school-outline',
          fields: [
            {
              name: 'educations',
              label: 'Education',
              type: 'repeater',
              icon: 'school-outline',
              addLabel: 'Add Education',
              emptyText: 'Wala pang naitatalang edukasyon.',
              titleFor: (item, index) => `Education ${index + 1}`,
              itemFields: [
                {
                  name: 'educational_attainment_school_id',
                  label: 'Educational attainment',
                  type: 'select',
                  options: byId(options, 'educational_attainment_school'),
                  required: true,
                },
                {
                  name: 'strand_id',
                  label: 'Strand / Track',
                  type: 'select',
                  options: byId(options, 'strand'),
                  visibleWhen: (item) =>
                    labelOf(options, 'educational_attainment_school', item.educational_attainment_school_id) ===
                    'Senior High School',
                  required: (item) =>
                    labelOf(options, 'educational_attainment_school', item.educational_attainment_school_id) ===
                    'Senior High School',
                },
                {
                  name: 'degree_id',
                  label: 'Degree',
                  type: 'select',
                  options: byId(options, 'degree'),
                  visibleWhen: (item) => isTertiary(options, item),
                  required: (item) => isTertiary(options, item),
                },
                {
                  name: 'school_id',
                  label: 'School',
                  type: 'select',
                  options: byId(options, 'school'),
                  required: true,
                },
                {
                  name: 'year_graduated',
                  label: 'Year graduated',
                  type: 'number',
                  icon: 'calendar-outline',
                  minValue: 1900,
                  maxValue: new Date().getFullYear(),
                  maxLength: 4,
                  visibleWhen: (item) => item.osy !== true,
                },
                { name: 'osy', label: 'Out of School Youth (OSY)', type: 'toggle' },
                {
                  name: 'osy_reason',
                  label: 'Reason for being OSY',
                  type: 'text',
                  placeholder: 'Explain why…',
                  visibleWhen: (item) => item.osy === true,
                  required: (item) => item.osy === true,
                },
                {
                  name: 'year_level',
                  label: 'Year level when stopped',
                  type: 'text',
                  placeholder: 'e.g., Grade 8, Year 2',
                  visibleWhen: (item) => item.osy === true,
                  required: (item) => item.osy === true,
                },
              ],
            },
          ],
        },
      ],
    },

    {
      id: 'special',
      title: 'Special status',
      shortTitle: 'Sectoral',
      icon: 'star-outline',
      sections: [
        {
          title: 'Special status',
          description: 'Batayan ito ng mga programa at ayuda ng barangay.',
          icon: 'ribbon-outline',
          fields: [
            // `lgbt` ang tunay na column; `lgbtq` sa web ay pang-gate lang.
            { name: 'lgbt', label: 'LGBTQ+', type: 'toggle' },
            {
              name: 'lgbtq_id',
              label: 'LGBTQ affiliation',
              type: 'select',
              options: byId(options, 'lgbtq'),
              visibleWhen: (v) => v.lgbt === true,
              required: (v) => v.lgbt === true,
            },
            { name: 'is_4ps_member', label: '4Ps member', type: 'toggle' },
            {
              name: 'four_ps_household_number',
              label: '4Ps household number',
              type: 'text',
              icon: 'card-outline',
              visibleWhen: (v) => v.is_4ps_member === true,
              required: (v) => v.is_4ps_member === true,
            },
            { name: 'pwd', label: 'PWD', type: 'toggle' },
            {
              name: 'pwd_types_id',
              label: 'PWD type',
              type: 'select',
              options: byId(options, 'pwd_type'),
              visibleWhen: (v) => v.pwd === true,
              required: (v) => v.pwd === true,
            },
            {
              name: 'pwd_registration_status',
              label: 'PWD registration status',
              type: 'select',
              options: PWD_REGISTRATION,
              visibleWhen: (v) => v.pwd === true,
              required: (v) => v.pwd === true,
            },
            {
              name: 'pwd_number',
              label: 'PWD number',
              type: 'text',
              icon: 'card-outline',
              visibleWhen: (v) => v.pwd === true && v.pwd_registration_status === 'Registered',
              required: (v) => v.pwd === true && v.pwd_registration_status === 'Registered',
            },
            { name: 'senior', label: 'Senior citizen', type: 'toggle' },
            {
              name: 'social_pension_status',
              label: 'Social pension status',
              type: 'select',
              options: SOCIAL_PENSION,
              visibleWhen: (v) => v.senior === true,
              required: (v) => v.senior === true,
            },
            {
              name: 'social_pension_number',
              label: 'Social pension number',
              type: 'text',
              icon: 'card-outline',
              visibleWhen: (v) =>
                v.senior === true && v.social_pension_status === 'Has Social Pension Number',
              required: (v) =>
                v.senior === true && v.social_pension_status === 'Has Social Pension Number',
            },
            { name: 'indigent_senior', label: 'Indigent senior', type: 'toggle' },
            { name: 'pensioner', label: 'Pensioner', type: 'toggle' },
            { name: 'ofw', label: 'OFW', type: 'toggle' },
            { name: 'indigenous_people', label: 'Indigenous people', type: 'toggle' },
            { name: 'solo_parent', label: 'Solo parent', type: 'toggle' },
            {
              name: 'solo_parent_registration_status',
              label: 'Solo parent registration status',
              type: 'select',
              options: SOLO_PARENT_REGISTRATION,
              visibleWhen: (v) => v.solo_parent === true,
              required: (v) => v.solo_parent === true,
            },
            {
              name: 'solo_parent_number',
              label: 'Solo parent number',
              type: 'text',
              icon: 'card-outline',
              visibleWhen: (v) =>
                v.solo_parent === true && v.solo_parent_registration_status === 'Registered',
              required: (v) =>
                v.solo_parent === true && v.solo_parent_registration_status === 'Registered',
            },
            // Walang `ethnicity` na column — pang-bukas lang ito ng pagpili,
            // gaya rin ng ginagawa nito sa web.
            { name: 'ethnicity', label: 'Ethnicity', type: 'toggle' },
            {
              name: 'ethnicity_id',
              label: 'Ethnicity',
              type: 'select',
              options: byId(options, 'ethnicity'),
              visibleWhen: (v) => v.ethnicity === true,
              required: (v) => v.ethnicity === true,
            },
          ],
        },
      ],
    },

    {
      id: 'government-ids',
      title: 'Government IDs',
      shortTitle: 'IDs',
      icon: 'card-outline',
      sections: [
        {
          title: 'Government IDs',
          description: 'Buksan lang ang mayroon — kailangan ang numero kapag naka-on.',
          icon: 'documents-outline',
          fields: [
            ...idPair('has_hdmf', 'Has HDMF?', 'hdmf_number', 'HDMF Number'),
            ...idPair('has_gsis', 'Has GSIS?', 'gsis_number', 'GSIS Number'),
            ...idPair('has_ph', 'Has PhilHealth?', 'ph_number', 'PhilHealth Number'),
            ...idPair('has_sss', 'Has SSS?', 'sss_number', 'SSS Number'),
            ...idPair('has_tin', 'Has TIN ID?', 'tin_number', 'TIN ID Number'),
          ],
        },
      ],
    },

    {
      id: 'voting',
      title: 'Voting & registration',
      shortTitle: 'Voting',
      icon: 'checkmark-circle-outline',
      sections: [
        {
          title: 'Voting & registration',
          description: 'Voting and registration details of the resident.',
          icon: 'checkmark-circle-outline',
          fields: [
            {
              // Sa web ay naka-disable ito at ang edad ang nagtatakda. Ganoon
              // din dito: nababasa pero hindi nababago.
              name: 'voting_eligibility_display',
              label: 'Voting eligibility',
              type: 'computed',
              icon: 'checkmark-circle-outline',
              hint: 'Automatically set to true when age is 15 or older.',
              compute: (v) => {
                const age = ageFrom(v);
                if (age === null) return 'Set a date of birth first';
                return age >= 15 ? 'Eligible' : 'Not eligible';
              },
            },
            { name: 'registered_voter', label: 'Registered voter', type: 'toggle' },
            {
              name: 'registered_brgy',
              label: 'Registered barangay',
              type: 'text',
              icon: 'flag-outline',
              autoCapitalize: 'words',
              visibleWhen: (v) => v.registered_voter === true,
            },
          ],
        },
      ],
    },

    {
      id: 'vaccination',
      title: 'Vaccination records',
      shortTitle: 'Vaccines',
      icon: 'heart-outline',
      sections: [
        {
          title: 'Vaccination records',
          description: 'Vaccination records of the resident.',
          icon: 'heart-outline',
          fields: [
            {
              name: 'vaccinations',
              label: 'Vaccination record',
              type: 'repeater',
              icon: 'heart-outline',
              addLabel: 'Add Vaccination Record',
              emptyText: 'Wala pang naitatalang bakuna.',
              titleFor: (item, index) =>
                item.type === 'child'
                  ? `Child vaccination ${index + 1}`
                  : item.type === 'adult'
                    ? `Adult vaccination ${index + 1}`
                    : `Vaccination ${index + 1}`,
              itemFields: [
                {
                  name: 'type',
                  label: 'Vaccination type',
                  type: 'segmented',
                  options: VACCINATION_TYPES,
                  required: true,
                },
                {
                  name: 'vaccine_type_id',
                  label: 'Vaccine type',
                  type: 'select',
                  options: byId(options, 'vaccine_type'),
                  visibleWhen: (item) => item.type === 'adult',
                  required: (item) => item.type === 'adult',
                },
                {
                  name: 'date_of_last_dose',
                  label: 'Date of last dose',
                  type: 'date',
                  visibleWhen: (item) => item.type === 'adult',
                },
                {
                  name: 'number_of_doses',
                  label: 'Number of doses',
                  type: 'number',
                  icon: 'calculator-outline',
                  minValue: 1,
                  visibleWhen: (item) => item.type === 'adult',
                },
                {
                  name: 'child_vaccines',
                  label: 'Vaccines received',
                  type: 'multiselect',
                  options: byId(options, 'child_vaccine'),
                  visibleWhen: (item) => item.type === 'child',
                  required: (item) => item.type === 'child',
                },
                {
                  name: 'date_of_vaccination',
                  label: 'Date of vaccination',
                  type: 'date',
                  visibleWhen: (item) => item.type === 'child',
                },
                {
                  name: 'next_due_date',
                  label: 'Next due date',
                  type: 'date',
                  visibleWhen: (item) => item.type === 'child',
                },
                { name: 'remarks', label: 'Remarks / Notes', type: 'textarea' },
                { name: 'certificate_photo', label: 'Certificate / Document', type: 'image' },
              ],
            },
          ],
        },
      ],
    },

    {
      id: 'household',
      title: 'Household & family',
      shortTitle: 'Household',
      icon: 'home-outline',
      sections: [
        {
          title: 'Household & family',
          description: 'Assign this resident to a household and family.',
          icon: 'home-outline',
          fields: [
            {
              name: 'household_id',
              label: 'Household',
              type: 'select',
              options: households,
              placeholder: 'Select a household',
              hint: 'The household this resident belongs to.',
            },
            {
              name: 'make_head_of_family',
              label: 'Make this resident the Head of Family',
              type: 'toggle',
              hint: 'Gagawa ng bagong pamilya kung saan siya ang ulo.',
            },
            {
              name: 'family_id',
              label: 'Head of Family',
              type: 'select',
              options: families,
              placeholder: 'Select a family',
              visibleWhen: (v) => v.make_head_of_family !== true,
              required: (v) => v.make_head_of_family !== true,
            },
            {
              name: 'family_name',
              label: 'New family name',
              type: 'text',
              icon: 'people-outline',
              autoCapitalize: 'words',
              visibleWhen: (v) => v.make_head_of_family === true,
              required: (v) => v.make_head_of_family === true,
            },
          ],
        },
      ],
    },
  ];

  /** Ang mga antas na may kaakibat na kurso. */
  function isTertiary(opts: FormSources['options'], item: FormValues): boolean {
    const name = labelOf(opts, 'educational_attainment_school', item.educational_attainment_school_id);

    return ['College', 'Under Graduate', 'College Graduate', 'Post Graduate'].includes(name ?? '');
  }
}

/** Toggle at ang numerong kasama nito — limang beses itong inuulit sa web. */
function idPair(
  toggleName: string,
  toggleLabel: string,
  numberName: string,
  numberLabel: string
): FieldDef[] {
  return [
    { name: toggleName, label: toggleLabel, type: 'toggle' },
    {
      name: numberName,
      label: numberLabel,
      type: 'text',
      icon: 'card-outline',
      visibleWhen: (v) => v[toggleName] === true,
      required: (v) => v[toggleName] === true,
    },
  ];
}
