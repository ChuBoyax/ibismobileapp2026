import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';

import { FieldRenderer } from './field-renderer';
import { isFieldVisible, type FieldValue, type FormValues, type SectionDef } from './types';

type FormSectionProps = {
  section: SectionDef;
  values: FormValues;
  errors: Record<string, string>;
  onChange: (name: string, value: FieldValue) => void;
};

/**
 * Isang pangkat ng magkakaugnay na tanong sa loob ng puting card. Ang mga
 * card ang nagbibigay ng hininga sa mahabang form — may malinaw na simula at
 * katapusan kada paksa imbes na tuluy-tuloy na listahan ng input.
 */
export function FormSection({ section, values, errors, onChange }: FormSectionProps) {
  const visibleFields = section.fields.filter((field) => isFieldVisible(field, values));

  // May mga seksyong nawawalan ng laman kapag hindi tugma ang mga sagot —
  // halimbawa ang detalye ng negosyo kapag walang negosyo ang sambahayan.
  if (visibleFields.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconRing}>
          <Ionicons name={section.icon} size={18} color={Colors.primary} />
        </View>

        <View style={styles.headerText}>
          <Text style={styles.title}>{section.title}</Text>
          {!!section.description && <Text style={styles.description}>{section.description}</Text>}
        </View>
      </View>

      {visibleFields.map((field) => (
        <FieldRenderer
          key={field.name}
          field={field}
          values={values}
          error={errors[field.name]}
          onChange={onChange}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadow.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  iconRing: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  description: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
});
