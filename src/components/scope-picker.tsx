import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import type { BarangayChoice } from '@/lib/api';

/**
 * Ang linya sa ilalim ng pangalan: aling barangay ang tinitingnan ngayon.
 *
 * DALAWANG PROBLEMA ANG SINASAGOT NITO NANG SABAY.
 *
 * ANG UNA: ANG HANAY NG PANGALAN AY HINDI KAYANG DUMAMI. Dati, pinagdurugtong
 * ang lahat ng barangay — "Baldoza · Super Admin · Kantasma · Mabagon". Kasya
 * iyon sa apat; sa labinlima, isa itong mahabang linyang pinuputol sa gitna at
 * walang sinasabi kahit kanino. Ang bilang ang mahalaga roon, hindi ang bawat
 * pangalan: "Municipal view · 4 barangays".
 *
 * ANG PANGALAWA: ANG SALAIN AY WALANG MALAGYAN. Ang mga stat card ay hinihila
 * paitaas sa ibabaw ng ilalim ng header — sinasadyang disenyo iyon — kaya ang
 * anumang ilagay sa pagitan ay natatabunan. Dito, walang hiwalay na hanay:
 * ang linyang nagsasabi kung ano ang tinitingnan ay siya na rin mismong
 * pindutan para palitan iyon. Isang bagay, hindi dalawa.
 *
 * Sa may iisang barangay, teksto lang ito at hindi mapipindot — walang
 * ipapalit, kaya walang ipinapangakong pindutan.
 */
export function ScopePicker({
  choices,
  selected,
  onSelect,
  fallback,
}: {
  choices: BarangayChoice[];
  /** null = lahat ng nasasakupan. */
  selected: number | null;
  onSelect: (value: number | null) => void;
  /** Ipinapakita habang wala pang listahan — galing sa profile. */
  fallback: string;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const many = choices.length > 1;
  const current = selected ? choices.find((barangay) => barangay.id === selected) : null;

  // `||` at hindi `??`: ang blangkong teksto ay dumadaan sa `??` at ang
  // kalalabasan ay walang lamang linya sa ilalim ng pangalan.
  const label = current
    ? current.name
    : many
      ? `Municipal view · ${choices.length} barangays`
      : choices[0]?.name || fallback || 'No barangay assigned';

  const icon = current || !many ? 'location-outline' : 'business-outline';

  if (!many) {
    return (
      <View style={styles.row}>
        <Ionicons name={icon} size={13} color={Colors.primaryLight} />
        <Text style={styles.text} numberOfLines={1}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.row, styles.tappable, pressed && styles.pressed]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Viewing ${label}. Tap to change barangay.`}>
        <Ionicons name={icon} size={13} color={Colors.onPrimary} />
        <Text style={[styles.text, styles.tappableText]} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons name="chevron-down" size={13} color={Colors.onPrimary} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.xl }]}
            onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>View barangay</Text>
            <Text style={styles.sheetHint}>
              Applies to the numbers and the recent activity below.
            </Text>

            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              <Option
                label="All barangays"
                hint={`Combined total of your ${choices.length} barangays`}
                active={selected === null}
                onPress={() => {
                  onSelect(null);
                  setOpen(false);
                }}
              />

              {choices.map((barangay, index) => (
                <Option
                  key={barangay.id}
                  label={barangay.name}
                  active={selected === barangay.id}
                  last={index === choices.length - 1}
                  onPress={() => {
                    onSelect(barangay.id);
                    setOpen(false);
                  }}
                />
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Option({
  label,
  hint,
  active,
  last,
  onPress,
}: {
  label: string;
  hint?: string;
  active: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.option, last && styles.lastOption, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button">
      <View style={styles.optionBody}>
        <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{label}</Text>
        {!!hint && <Text style={styles.optionHint}>{hint}</Text>}
      </View>

      {active && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
  },
  // Kapag mapipindot, may sariling anyo ito ng pindutan — hindi puwedeng
  // magmukhang teksto lang ang bagay na may gagawin kapag pinindot.
  tappable: {
    alignSelf: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.onPrimaryFaded,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    flexShrink: 1,
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
    letterSpacing: 0.2,
  },
  tappableText: {
    fontWeight: '700',
    color: Colors.onPrimary,
  },

  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(10, 42, 24, 0.45)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.header,
    borderTopRightRadius: Radius.header,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  sheetTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  sheetHint: {
    marginTop: 2,
    marginBottom: Spacing.sm,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  lastOption: {
    borderBottomWidth: 0,
  },
  optionBody: {
    flex: 1,
  },
  optionLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  optionLabelActive: {
    fontWeight: '700',
    color: Colors.primary,
  },
  optionHint: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
});
