import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SummaryCards } from '@/components/summary-cards';
import type { FormValues, StepDef } from '@/components/form/types';
import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { buildSummary, countFilled } from '@/features/registration/build-summary';
import type { ExistingPhotos } from '@/features/registration/existing-photos';
import { goBack } from '@/lib/navigation';

type RecordViewScreenProps = {
  title: string;
  subtitle: string;
  steps: StepDef[];
  values: FormValues;
  existingPhotos: ExistingPhotos;
  /** Ruta ng form, hal. "/registration/resident?id=5&edit=1". */
  editHref: (step?: number) => string;
  /** Totoo kapag may naka-queue pang pagbabagong hindi pa naipapadala. */
  pending?: boolean;
};

/**
 * Ang mukha ng isang naitalang residente, sambahayan o pamilya.
 *
 * BAKIT HINDI NA DIRETSO SA FORM ANG PAGPINDOT SA LISTAHAN.
 *
 * Dati, ang pagbukas ng isang tala ay agad na nagbubukas ng labing-isang
 * hakbang na form. Tatlong bagay ang mali roon. Ang pinakakaraniwang dahilan
 * ng pagbukas ay TINGNAN ang tala, hindi baguhin — at para lang makita ang
 * isang numero ng telepono, kailangang magdaan sa buong stepper. Pangalawa,
 * walang paraan para tingnan ang isang tala nang walang panganib na
 * makagalaw ng sagot. Pangatlo, ang form ay nagpapakita ng isang field kada
 * pagkakataon; ang tala ay dapat mabasa nang buo.
 *
 * Kaya buod muna, at ang stepper ay nasa likod ng pindutang "Edit".
 */
export function RecordViewScreen({
  title,
  subtitle,
  steps,
  values,
  existingPhotos,
  editHref,
  pending,
}: RecordViewScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const summary = useMemo(
    () => buildSummary(steps, values, existingPhotos),
    [steps, values, existingPhotos]
  );

  const filled = countFilled(summary);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          style={styles.headerButton}
          onPress={() => goBack()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={20} color={Colors.onPrimary} />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}>
        {!!pending && (
          // Ang ipinapakita sa ibaba ay ang naka-queue na sagot, hindi ang
          // laman ng server. Kung hindi ito sasabihin, mukhang naipasa na ang
          // pagbabago gayong nasa telepono pa lang ito.
          <Animated.View entering={FadeInDown.duration(240)} style={styles.pendingBanner}>
            <Ionicons name="cloud-upload-outline" size={20} color={Colors.info} />
            <Text style={styles.pendingText}>
              This record has changes waiting to be sent. You are seeing those changes here.
            </Text>
          </Animated.View>
        )}

        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {filled} field{filled === 1 ? '' : 's'} filled
          </Text>
        </View>

        <SummaryCards groups={summary} onEditStep={(step) => router.push(editHref(step) as never)} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
        <Pressable
          style={styles.editButton}
          onPress={() => router.push(editHref() as never)}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${title}`}>
          <Ionicons name="create-outline" size={19} color={Colors.onPrimary} />
          <Text style={styles.editLabel}>Edit</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Colors.onPrimaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.onPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    marginTop: 1,
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
  },
  body: {
    padding: Spacing.lg,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.infoLight,
    marginBottom: Spacing.lg,
  },
  pendingText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.info,
    lineHeight: 19,
  },
  countRow: {
    marginBottom: Spacing.md,
  },
  countText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.muted,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    ...Shadow.card,
  },
  editLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
});
