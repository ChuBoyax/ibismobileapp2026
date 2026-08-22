import type { StepDef } from '@/components/form/types';

import { byId } from './options';
import type { FormSources } from './sources';


export function familySteps({ options, residents, households }: FormSources): StepDef[] {
  return [
    {
      id: 'details',
      title: 'Family information',
      shortTitle: 'Family',
      icon: 'people-outline',
      sections: [
        {
          title: 'Family information',
          description: 'Basic details about the family.',
          icon: 'people-circle-outline',
          fields: [
            {
            
              name: 'resident_id',
              label: 'Head of Family',
              type: 'select',
              options: residents,
              placeholder: 'Search a resident',
              required: true,
            },
            {
              name: 'family_name',
              label: 'Family Name',
              type: 'text',
              icon: 'people-outline',
              autoCapitalize: 'words',
              required: true,
            },
            {
              name: 'family_type_id',
              label: 'Family Type',
              type: 'select',
              options: byId(options, 'family_type'),
              required: true,
            },
            {
              name: 'income_level_id',
              label: 'Income Level',
              type: 'select',
              options: byId(options, 'income_level'),
              required: true,
            },
            {
              name: 'contact_information',
              label: 'Contact Information',
              type: 'text',
              icon: 'call-outline',
              placeholder: '09171234567',
              hint: 'Numbers only, exactly 11 digits.',
              digitsOnly: true,
              exactLength: 11,
            },
            {
              name: 'origin',
              label: 'Origin',
              type: 'text',
              icon: 'location-outline',
              autoCapitalize: 'words',
            },
          ],
        },
        {
          title: 'Household',
          description: 'Maaaring maraming pamilya sa iisang sambahayan.',
          icon: 'home-outline',
          fields: [
            {
              name: 'household_id',
              label: 'Household',
              type: 'select',
              options: households,
              placeholder: 'Select a household',
            },
          ],
        },
      ],
    },
  ];
}
