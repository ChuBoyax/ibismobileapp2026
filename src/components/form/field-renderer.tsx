import { DateField } from './date-field';
import { ImageField } from './image-field';
import { InputField } from './input-field';
import { MultiSelectField } from './multi-select-field';
import { RepeaterField } from './repeater-field';
import { SegmentedField } from './segmented-field';
import { SelectField } from './select-field';
import { ToggleField } from './toggle-field';
import { isFieldRequired, type FieldDef, type FieldValue, type FormValues } from './types';

type FieldRendererProps = {
  field: FieldDef;
  values: FormValues;
  error?: string;
  onChange: (name: string, value: FieldValue) => void;
};

/**
 * Isinasalin ang isang field definition sa tamang input component.
 *
 * Dito nakasalalay ang pagiging scalable ng mga form: ang pagdagdag ng bagong
 * tanong ay pagdagdag lang ng entry sa schema, hindi bagong JSX.
 */
export function FieldRenderer({ field, values, error, onChange }: FieldRendererProps) {
  const raw = values[field.name];
  const required = isFieldRequired(field, values);
  const asText = typeof raw === 'string' ? raw : '';

  switch (field.type) {
    case 'toggle':
      return (
        <ToggleField
          label={field.label}
          hint={field.hint}
          value={raw === true}
          onChange={(next) => onChange(field.name, next)}
        />
      );

    case 'image':
      return (
        <ImageField
          name={field.name}
          label={field.label}
          hint={field.hint}
          required={required}
          error={error}
          value={asText || null}
          onChange={(uri) => onChange(field.name, uri)}
        />
      );

    case 'repeater':
      return (
        <RepeaterField
          label={field.label}
          addLabel={field.addLabel ?? `Add ${field.label}`}
          emptyText={field.emptyText ?? 'Wala pang naidadagdag.'}
          icon={field.icon ?? 'list-outline'}
          titleFor={field.titleFor}
          fields={field.itemFields ?? []}
          items={Array.isArray(raw) && typeof raw[0] !== 'string' ? (raw as FormValues[]) : []}
          onChange={(items) => onChange(field.name, items)}
          renderField={(args) => <FieldRenderer {...args} />}
        />
      );

    case 'multiselect':
      return (
        <MultiSelectField
          label={field.label}
          hint={field.hint}
          required={required}
          error={error}
          placeholder={field.placeholder}
          options={field.options ?? []}
          value={Array.isArray(raw) ? (raw as string[]) : []}
          onChange={(next) => onChange(field.name, next)}
        />
      );

    case 'select':
      return (
        <SelectField
          label={field.label}
          hint={field.hint}
          required={required}
          error={error}
          icon={field.icon}
          placeholder={field.placeholder}
          options={field.options ?? []}
          value={asText || null}
          onChange={(next) => onChange(field.name, next)}
        />
      );

    case 'segmented':
      return (
        <SegmentedField
          label={field.label}
          hint={field.hint}
          required={required}
          error={error}
          options={field.options ?? []}
          value={asText || null}
          onChange={(next) => onChange(field.name, next)}
        />
      );

    case 'date':
      return (
        <DateField
          label={field.label}
          hint={field.hint}
          required={required}
          error={error}
          value={asText}
          onChange={(next) => onChange(field.name, next)}
        />
      );

    case 'computed':
      // Galing sa ibang sagot ang laman, kaya nakasara ito sa pag-edit —
      // gaya ng edad na sinusundan ang petsa ng kapanganakan.
      return (
        <InputField
          label={field.label}
          hint={field.hint}
          icon={field.icon}
          readOnly
          value={field.compute ? field.compute(values) : asText}
          onChangeText={() => {}}
        />
      );

    case 'number':
    case 'textarea':
    case 'text':
    default:
      return (
        <InputField
          label={field.label}
          hint={field.hint}
          required={required}
          error={error}
          icon={field.icon}
          placeholder={field.placeholder}
          multiline={field.type === 'textarea'}
          digitsOnly={field.digitsOnly ?? field.type === 'number'}
          maxLength={field.maxLength ?? field.exactLength}
          keyboardType={
            field.type === 'number' || field.digitsOnly ? 'numeric' : field.keyboardType
          }
          autoCapitalize={field.autoCapitalize}
          value={asText}
          onChangeText={(next) => onChange(field.name, next)}
        />
      );
  }
}
