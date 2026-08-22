

export type SelectOption = {
  value: string;
  label: string;
};


const literal = (labels: readonly string[]): SelectOption[] =>
  labels.map((label) => ({ value: label, label }));



export const OSY_REASONS = literal([
  'Financial Constraints',
  'Employment',
  'Early Marriage / Pregnancy',
  'Illness or Disability',
  'Lack of Interest',
  'Distance from School',
  'Others',
]);

export const YEAR_LEVELS = literal([
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
  '1st Year College',
  '2nd Year College',
  '3rd Year College',
  '4th Year College',
]);



export const REGISTRATION_STATUSES = literal([
  'Registered',
  'Not Registered',
  'For Renewal',
  'Pending',
]);



export const WATER_POTABILITY = literal(['Potable', 'Non-potable', 'Not Tested']);

export const POTABILITY_BASIS = literal([
  'Laboratory Test Result',
  'Sanitary Inspection',
  'Declared by Household',
]);
