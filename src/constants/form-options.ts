/**
 * Mga pipiliang nananatiling nakasulat sa app.
 *
 * Karamihan ng dropdown ay galing na sa `/api/ibis/options` — naka-angkla sila
 * sa `options` na talahanayan at nag-iiba kada barangay. Ang natitira rito ay
 * para sa mga column na tekstong-tuwiran (hindi foreign key), kaya ang mismong
 * sinulat na halaga ang naiimbak. Walang mapagkukunan ang mga ito sa database.
 */

export type SelectOption = {
  value: string;
  label: string;
};

/** Ang halaga mismo ang naiimbak, kaya pareho ang value at label. */
const literal = (labels: readonly string[]): SelectOption[] =>
  labels.map((label) => ({ value: label, label }));

/* ── residents.osy_reason / osy_year_level ──────────────────────────── */

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

/* ── residents.*_registration_status / social_pension_status ────────── */

export const REGISTRATION_STATUSES = literal([
  'Registered',
  'Not Registered',
  'For Renewal',
  'Pending',
]);

/* ── households.water_potability / potability_basis ─────────────────── */

export const WATER_POTABILITY = literal(['Potable', 'Non-potable', 'Not Tested']);

export const POTABILITY_BASIS = literal([
  'Laboratory Test Result',
  'Sanitary Inspection',
  'Declared by Household',
]);
