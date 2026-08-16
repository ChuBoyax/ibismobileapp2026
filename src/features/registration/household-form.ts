import type { StepDef } from '@/components/form/types';


import { byId } from './options';
import type { FormSources } from './sources';

/**
 * Talatanungan para sa isang sambahayan, ayon sa `households` na talahanayan
 * ng RBI web — pati ang mga field na idinagdag sa mga huling migration:
 * potability ng tubig, negosyo, hazard at koordinado.
 */
/** Mga literal na halaga — hindi id ng option ang ipinapadala ng web dito. */
function literal(values: readonly string[]) {
  return values.map((value) => ({ value, label: value }));
}

export function householdSteps({ options }: FormSources): StepDef[] {
  return [
    {
      id: 'location',
      title: 'Location',
      shortTitle: 'Location',
      icon: 'map-outline',
      sections: [
        {
          title: 'Household address',
          description: 'Idinaragdag ng server ang code ng barangay sa house number.',
          icon: 'home-outline',
          fields: [
            {
              name: 'house_number',
              label: 'House number',
              type: 'text',
              icon: 'home-outline',
              placeholder: '0123-A',
              required: true,
            },
            {
              name: 'household_address_id',
              label: 'Address / purok',
              type: 'select',
              options: byId(options, 'purok'),
              required: true,
            },
            { name: 'sitio_id', label: 'Sitio', type: 'select', options: byId(options, 'sitio') },
          ],
        },
        {
          title: 'Map coordinates',
          description: 'Ginagamit sa mapa ng barangay at sa pagpaplano sa sakuna.',
          icon: 'navigate-outline',
          fields: [
            {
              name: 'latitude',
              label: 'Latitude',
              type: 'text',
              icon: 'navigate-outline',
              placeholder: '10.3167',
              keyboardType: 'numeric',
            },
            {
              name: 'longitude',
              label: 'Longitude',
              type: 'text',
              icon: 'navigate-outline',
              placeholder: '124.7833',
              keyboardType: 'numeric',
            },
          ],
        },
      ],
    },

    {
      id: 'structure',
      title: 'House structure',
      shortTitle: 'Structure',
      icon: 'business-outline',
      sections: [
        {
          title: 'Type and ownership',
          icon: 'key-outline',
          fields: [
            {
              name: 'house_type_id',
              label: 'Type of house',
              type: 'select',
              options: byId(options, 'house_type'),
              required: true,
            },
            {
              name: 'ownership_type_id',
              label: 'Ownership',
              type: 'select',
              options: byId(options, 'ownership_type'),
              required: true,
            },
            {
              name: 'types_of_materials_id',
              label: 'Building materials',
              type: 'select',
              options: byId(options, 'types_of_materials'),
              required: true,
            },
            { name: 'year_built', label: 'Year built', type: 'date' },
          ],
        },
        {
          title: 'Size',
          icon: 'resize-outline',
          fields: [
            { name: 'floor_levels', label: 'Number of floors', type: 'number', icon: 'layers-outline' },
            { name: 'number_of_rooms', label: 'Number of rooms', type: 'number', icon: 'bed-outline' },
            { name: 'floor_area', label: 'Floor area (sqm)', type: 'number', icon: 'square-outline' },
          ],
        },
      ],
    },

    {
      id: 'utilities',
      title: 'Utilities and sanitation',
      shortTitle: 'Utilities',
      icon: 'water-outline',
      sections: [
        {
          title: 'Water',
          icon: 'water-outline',
          fields: [
            { name: 'has_water', label: 'Has water supply', type: 'toggle' },
            {
              name: 'source_of_water_id',
              label: 'Source of water',
              type: 'select',
              options: byId(options, 'source_of_water'),
              visibleWhen: (v) => v.has_water === true,
            },
            {
              name: 'source_of_drinking_water_id',
              label: 'Source of drinking water',
              type: 'select',
              options: byId(options, 'source_of_drinking_water'),
              required: true,
            },
            {
              // Lumalabas lang kapag may pinagkukunan na ng inuming tubig, at
              // ang basehan naman ay kapag Potable — ganito rin ang web.
              name: 'water_potability',
              label: 'Water Potability',
              type: 'select',
              options: literal(['Potable', 'Non-Potable']),
              visibleWhen: (v) => !!v.source_of_drinking_water_id,
              required: (v) => !!v.source_of_drinking_water_id,
            },
            {
              name: 'potability_basis',
              label: 'Potability Basis',
              type: 'select',
              options: literal([
                'Water Quality Test',
                'Water Provider/Certification',
                'Household Treatment',
                'No Testing',
              ]),
              visibleWhen: (v) => v.water_potability === 'Potable',
              required: (v) => v.water_potability === 'Potable',
            },
          ],
        },
        {
          title: 'Power and connectivity',
          icon: 'flash-outline',
          fields: [
            { name: 'has_electricity', label: 'Has electricity', type: 'toggle' },
            { name: 'has_internet', label: 'Has internet', type: 'toggle' },
            {
              name: 'internet_type_id',
              label: 'Type of connection',
              type: 'select',
              options: byId(options, 'internet_type'),
              visibleWhen: (v) => v.has_internet === true,
            },
          ],
        },
        {
          title: 'Sanitation',
          icon: 'medkit-outline',
          fields: [
            { name: 'has_toilet', label: 'Has toilet', type: 'toggle' },
            {
              name: 'toilet_type_id',
              label: 'Type of toilet',
              type: 'select',
              options: byId(options, 'toilet_type'),
              visibleWhen: (v) => v.has_toilet === true,
            },
            {
              name: 'number_of_toilet',
              label: 'Number of toilets',
              type: 'number',
              icon: 'calculator-outline',
              visibleWhen: (v) => v.has_toilet === true,
            },
          ],
        },
      ],
    },

    {
      id: 'photos',
      title: 'Household photos',
      shortTitle: 'Photos',
      icon: 'camera-outline',
      sections: [
        {
          title: 'Household Photos',
          icon: 'camera-outline',
          fields: [{ name: 'household_photos', label: 'Household Photos', type: 'image' }],
        },
      ],
    },

    {
      id: 'livelihood',
      title: 'Household livelihood',
      shortTitle: 'Livelihood',
      icon: 'storefront-outline',
      sections: [
        {
          title: 'Business',
          description: 'Anumang kabuhayang pinapatakbo sa loob ng sambahayan.',
          icon: 'storefront-outline',
          fields: [
            { name: 'has_business', label: 'Has a business', type: 'toggle' },
            {
              name: 'business_name',
              label: 'Business name',
              type: 'text',
              icon: 'pricetag-outline',
              autoCapitalize: 'words',
              visibleWhen: (v) => v.has_business === true,
            },
            {
              name: 'business_type_id',
              label: 'Type of business',
              type: 'select',
              options: byId(options, 'business_type'),
              visibleWhen: (v) => v.has_business === true,
            },
            {
              name: 'business_registered',
              label: 'Registered with the barangay',
              type: 'toggle',
              visibleWhen: (v) => v.has_business === true,
            },
          ],
        },
      ],
    },

    {
      id: 'hazards',
      title: 'Hazard exposure',
      shortTitle: 'Hazards',
      icon: 'warning-outline',
      sections: [
        {
          title: 'Hazard-prone area',
          description: 'Batayan ng pre-emptive evacuation at risk mapping.',
          icon: 'warning-outline',
          fields: [
            {
              // Pivot ang hawak nito sa web (household_hazard_type), hindi ang
              // magkakahiwalay na boolean na column.
              name: 'hazard_types',
              label: 'Hazards affecting this household',
              type: 'multiselect',
              options: byId(options, 'hazard_type'),
              placeholder: 'Select all that apply',
            },
          ],
        },
      ],
    },

    {
      id: 'occupancy',
      title: 'Occupancy',
      shortTitle: 'Occupancy',
      icon: 'people-outline',
      sections: [
        {
          title: 'Who lives here',
          icon: 'people-outline',
          fields: [
            {
              name: 'number_of_residents',
              label: 'Number of residents',
              type: 'number',
              icon: 'people-outline',
            },
            {
              name: 'number_of_families_living',
              label: 'Number of families living',
              type: 'number',
              icon: 'home-outline',
              hint: 'Maaaring higit sa isang pamilya ang nakatira sa isang bahay.',
            },
          ],
        },
      ],
    },
  ];
}
