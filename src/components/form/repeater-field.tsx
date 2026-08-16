import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

import {
  isFieldVisible,
  validateField,
  type FieldDef,
  type FieldValue,
  type FormValues,
  type IoniconName,
} from './types';

/** Isang entry sa loob ng repeater — ganoon din ang hugis ng buong form. */
export type RepeaterItem = FormValues;

type RepeaterFieldProps = {
  label: string;
  addLabel: string;
  icon: IoniconName;
  /** Mga tanong na inuulit kada entry. */
  fields: FieldDef[];
  items: RepeaterItem[];
  onChange: (items: RepeaterItem[]) => void;
  emptyText: string;
  /** Ipinapakita bilang pamagat ng bawat entry. */
  titleFor?: (item: RepeaterItem, index: number) => string;
  /**
   * Ibinibigay ng field-renderer ang sarili nito rito.
   *
   * Kung tuwirang ini-import ng repeater ang renderer, magkabilaan ang
   * pagtukoy nila at nagiging paikot ang import — may pagkakataong wala pang
   * laman ang isa sa kanila sa oras na kailanganin. Sa pamamagitan ng props
   * naiiwasan iyon nang hindi nawawala ang pagiging recursive.
   */
  renderField: (args: {
    field: FieldDef;
    values: FormValues;
    error?: string;
    onChange: (name: string, value: FieldValue) => void;
  }) => React.ReactNode;
};

/**
 * Maramihang entry para sa mga ugnayang hasMany — edukasyon at bakuna.
 *
 * Hiwalay silang tala sa database, kaya hindi sila kayang ilagay bilang
 * patag na field: maaaring dalawa ang natapos na antas ng isang residente,
 * o lima ang naitalang bakuna ng isang bata.
 */
export function RepeaterField({
  label,
  addLabel,
  icon,
  fields,
  items,
  onChange,
  emptyText,
  titleFor,
  renderField,
}: RepeaterFieldProps) {
  const update = (index: number, name: string, value: FieldValue) => {
    onChange(items.map((item, i) => (i === index ? { ...item, [name]: value } : item)));
  };

  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      {items.length === 0 && <Text style={styles.empty}>{emptyText}</Text>}

      {items.map((item, index) => (
        <Animated.View
          key={index}
          entering={FadeInDown.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.item}>
          <View style={styles.itemHeader}>
            <View style={styles.itemBadge}>
              <Ionicons name={icon} size={15} color={Colors.primary} />
            </View>
            <Text style={styles.itemTitle}>
              {titleFor ? titleFor(item, index) : `${label} ${index + 1}`}
            </Text>
            <Pressable
              onPress={() => remove(index)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${label} ${index + 1}`}>
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
            </Pressable>
          </View>

          {fields
            .filter((field) => isFieldVisible(field, item))
            .map((field) => (
              <View key={field.name}>
                {renderField({
                  field,
                  values: item,
                  // Ipinapakita agad ang mali kada entry — walang ibang
                  // pagkakataon na masuri ito dahil hindi hakbang ang repeater.
                  error: validateField(field, item[field.name] ?? null, item) ?? undefined,
                  onChange: (name, value) => update(index, name, value),
                })}
              </View>
            ))}
        </Animated.View>
      ))}

      <Pressable
        style={styles.add}
        onPress={() => onChange([...items, {}])}
        accessibilityRole="button">
        <Ionicons name="add-circle-outline" size={19} color={Colors.primary} />
        <Text style={styles.addLabel}>{addLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  empty: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  item: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  itemBadge: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 48,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
  },
  addLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
});
