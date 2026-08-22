import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SummaryCards } from '@/components/summary-cards';
import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { buildSummary, countFilled } from '@/features/registration/build-summary';
import {
  ExistingPhotoProvider,
  type ExistingPhotos,
} from '@/features/registration/existing-photos';
import { goBack } from '@/lib/navigation';

import { FormSection } from './form-section';
import { validateStep, type FieldValue, type FormValues, type StepDef } from './types';

type FormWizardProps = {
  title: string;
  subtitle: string;
  steps: StepDef[];
  initialValues?: FormValues;
  /**
   * Mga larawang naka-upload na para sa talang ito. Ipinapakita lang — hindi
   * sila nagiging sagot sa form. Tingnan ang `existingPhotos`.
   */
  existingPhotos?: ExistingPhotos;
  /**
   * Saang hakbang bubukas. Ginagamit ng view page kapag pinindot ang isang
   * seksyon: doon mismo bumubukas ang form, hindi sa simula ng labing-isa.
   */
  initialStep?: number;
  /** Ipinapakita sa success modal pagkatapos ng huling hakbang. */
  successMessage: string;
  /** Ipinapadala ang tala sa server. Ang pagkabigo ay ipinapakita sa review. */
  onSubmit: (values: FormValues) => Promise<void>;
};

/**
 * Pangkalahatang shell ng mga multi-step na form.
 *
 * Hinahati ang mahabang talatanungan ng RBI sa mga hakbang na kayang tapusin
 * nang isahan, at nagdadagdag ng review bago ang pag-save. Walang alam ang
 * component na ito sa residente o sambahayan — sa schema lang ito umaasa,
 * kaya pareho itong magagamit ng lahat ng form.
 */
export function FormWizard({
  title,
  subtitle,
  steps,
  initialValues = {},
  existingPhotos = {},
  initialStep = 0,
  successMessage,
  onSubmit,
}: FormWizardProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [values, setValues] = useState<FormValues>(initialValues);
  // Nakatakda sa pagbukas: ang paglipat pagkatapos ay hawak na ng gumagamit,
  // kaya hindi na ito sumusunod sa prop kahit magbago pa iyon.
  const [stepIndex, setStepIndex] = useState(Math.min(initialStep, steps.length));
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Ang review ang huling hakbang, kaya isa itong dagdag sa bilang ng schema.
  const totalSteps = steps.length + 1;
  const isReview = stepIndex === steps.length;
  const step = steps[stepIndex];

  const handleChange = (name: string, value: FieldValue) => {
    setValues((prev) => ({ ...prev, [name]: value }));

    // Nawawala agad ang pula pagkatapos itama, sa halip na maghintay ng
    // susunod na pagpindot sa Continue.
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const goTo = (next: number) => {
    setStepIndex(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleNext = async () => {
    if (!isReview) {
      // Hindi papayagang lumipat hangga't may kulang — mas madaling itama
      // ngayon kaysa bumalik mula sa review pagkalipas ng pitong hakbang.
      const found = validateStep(step, values);

      if (Object.keys(found).length > 0) {
        setErrors(found);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }

      setErrors({});
      goTo(stepIndex + 1);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await onSubmit(values);
      setSaved(true);
    } catch (error) {
      // Nananatili ang mga sagot para maiayos at maipadala ulit — hindi
      // katanggap-tanggap na mawala ang mahabang form dahil sa isang timeout.
      setSubmitError(
        error instanceof Error ? error.message : 'Cannot save the record right now.'
      );
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (stepIndex === 0) {
      goBack();
      return;
    }
    goTo(stepIndex - 1);
  };

  const progress = (stepIndex + 1) / totalSteps;

  // Umaabante ang bar nang dahan-dahan patungo sa bagong hakbang. Ang paglaki
  // mismo ang nagsasabing may natapos — mas mahalagang senyas iyon kaysa sa
  // bilang na nasa ilalim nito.
  const progressValue = useSharedValue(progress);

  useEffect(() => {
    progressValue.value = withTiming(progress, { duration: 320 });
  }, [progress, progressValue]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value * 100}%`,
  }));

  return (
    // Konteksto sa halip na props: nakabaon ang ImageField sa ilalim ng apat
    // na component na wala namang gagawin sa mapa kundi ipasa ito. Tingnan
    // ang existing-photos.
    <ExistingPhotoProvider photos={existingPhotos}>
    <View style={styles.screen}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerRow}>
          <Pressable
            style={styles.headerButton}
            onPress={handleBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={20} color={Colors.onPrimary} />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{title}</Text>
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressStyle]} />
        </View>

        <Text style={styles.progressLabel}>
          Step {stepIndex + 1} of {totalSteps} · {isReview ? 'Review' : step.shortTitle}
        </Text>
      </View>

      <StepPills
        steps={steps}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        onSelect={goTo}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.body, { paddingBottom: Spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Ang key ang nagpapalit ng laman kada hakbang, kaya tuwing
              magbabago ito ay may bagong pagpasok na nagpapakita ng direksyon. */}
          <Animated.View key={stepIndex} entering={FadeInRight.duration(240)}>
            {isReview ? (
              <ReviewStep
                steps={steps}
                values={values}
                photos={existingPhotos}
                onEditStep={goTo}
                error={submitError}
              />
            ) : (
              <>
                <Text style={styles.stepTitle}>{step.title}</Text>
                {step.sections.map((section) => (
                  <FormSection
                    key={section.title}
                    section={section}
                    values={values}
                    errors={errors}
                    onChange={handleChange}
                  />
                ))}
              </>
            )}
          </Animated.View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          {stepIndex > 0 && (
            <Pressable
              style={[styles.button, styles.buttonGhost]}
              onPress={handleBack}
              disabled={submitting}
              accessibilityRole="button">
              <Ionicons name="chevron-back" size={18} color={Colors.primaryDark} />
              <Text style={styles.buttonGhostLabel}>Back</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.button, styles.buttonPrimary, submitting && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting }}>
            {submitting ? (
              <>
                <ActivityIndicator color={Colors.onPrimary} size="small" />
                <Text style={styles.buttonPrimaryLabel}>Saving…</Text>
              </>
            ) : (
              <>
                <Text style={styles.buttonPrimaryLabel}>
                  {isReview ? 'Save record' : 'Continue'}
                </Text>
                <Ionicons
                  name={isReview ? 'checkmark' : 'chevron-forward'}
                  size={18}
                  color={Colors.onPrimary}
                />
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <SuccessModal
        visible={saved}
        message={successMessage}
        onDone={() => {
          setSaved(false);
          goBack();
        }}
      />
    </View>
    </ExistingPhotoProvider>
  );
}

/* ── Stepper na pahalang ────────────────────────────────────────────── */

function StepPills({
  steps,
  stepIndex,
  totalSteps,
  onSelect,
}: {
  steps: StepDef[];
  stepIndex: number;
  totalSteps: number;
  onSelect: (index: number) => void;
}) {
  const pills = [
    ...steps.map((step) => ({ label: step.shortTitle, icon: step.icon })),
    { label: 'Review', icon: 'checkmark-done-outline' as const },
  ];

  return (
    <View style={styles.pillsWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pills}>
        {pills.map((pill, index) => {
          const active = index === stepIndex;
          const done = index < stepIndex;

          return (
            <Pressable
              key={pill.label}
              style={[styles.pill, active && styles.pillActive, done && styles.pillDone]}
              // Pabalik lang ang pagtalon para hindi malaktawan ang mga hakbang.
              onPress={() => index <= stepIndex && onSelect(index)}
              disabled={index > stepIndex}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: index > stepIndex }}>
              <Ionicons
                name={done ? 'checkmark-circle' : pill.icon}
                size={15}
                color={active ? Colors.onPrimary : done ? Colors.primary : Colors.muted}
              />
              <Text
                style={[
                  styles.pillLabel,
                  active && styles.pillLabelActive,
                  done && styles.pillLabelDone,
                ]}>
                {pill.label}
              </Text>
            </Pressable>
          );
        })}
        <View style={styles.pillCounter}>
          <Text style={styles.pillCounterText}>{totalSteps} steps</Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* ── Review ─────────────────────────────────────────────────────────── */

function ReviewStep({
  steps,
  values,
  photos,
  onEditStep,
  error,
}: {
  steps: StepDef[];
  values: FormValues;
  photos: ExistingPhotos;
  onEditStep: (index: number) => void;
  error: string | null;
}) {
  // Binubuo mula mismo sa schema, kaya awtomatikong lumalabas dito ang anumang
  // bagong field na idadagdag sa hinaharap. Kapareho ito ng ginagamit ng view
  // page — tingnan ang build-summary kung bakit iisa lang sila.
  const summary = useMemo(() => buildSummary(steps, values, photos), [steps, values, photos]);
  const filledCount = countFilled(summary);

  return (
    <>
      <Text style={styles.stepTitle}>Review before saving</Text>

      {!!error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={20} color={Colors.danger} />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      <View style={styles.reviewBanner}>
        <Ionicons name="information-circle-outline" size={20} color={Colors.info} />
        <Text style={styles.reviewBannerText}>
          {filledCount} field{filledCount === 1 ? '' : 's'} filled. Tap any section to go back and
          make changes.
        </Text>
      </View>

      <SummaryCards groups={summary} onEditStep={onEditStep} />
    </>
  );
}

/* ── Success ────────────────────────────────────────────────────────── */

function SuccessModal({
  visible,
  message,
  onDone,
}: {
  visible: boolean;
  message: string;
  onDone: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.successBackdrop}>
        <View style={styles.successCard}>
          <View style={styles.successRing}>
            <Ionicons name="checkmark" size={34} color={Colors.primary} />
          </View>

          <Text style={styles.successTitle}>Record saved</Text>
          <Text style={styles.successMessage}>{message}</Text>

          <Pressable
            style={[styles.button, styles.successButton]}
            onPress={onDone}
            accessibilityRole="button">
            <Text style={styles.buttonPrimaryLabel}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
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
  progressTrack: {
    height: 5,
    borderRadius: Radius.pill,
    backgroundColor: Colors.onPrimaryFaded,
    marginTop: Spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
  },
  progressLabel: {
    marginTop: Spacing.sm,
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.primaryLight,
  },
  pillsWrapper: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  pills: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
  },
  pillActive: {
    backgroundColor: Colors.primary,
  },
  pillDone: {
    backgroundColor: Colors.primaryLight,
  },
  pillLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.muted,
  },
  pillLabelActive: {
    color: Colors.onPrimary,
  },
  pillLabelDone: {
    color: Colors.primaryDark,
  },
  pillCounter: {
    paddingHorizontal: Spacing.md,
  },
  pillCounterText: {
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  body: {
    padding: Spacing.lg,
  },
  stepTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.lg,
    letterSpacing: -0.2,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: Radius.md,
  },
  buttonPrimary: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  buttonPrimaryLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
  buttonGhost: {
    paddingHorizontal: Spacing.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  buttonGhostLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerLight,
    marginBottom: Spacing.lg,
  },
  errorBannerText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.danger,
    lineHeight: 19,
  },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.infoLight,
    marginBottom: Spacing.lg,
  },
  reviewBannerText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.info,
    lineHeight: 19,
  },
  successBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: 'rgba(10, 42, 24, 0.5)',
  },
  successCard: {
    width: '100%',
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadow.raised,
  },
  successRing: {
    width: 70,
    height: 70,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  successTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  successMessage: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Sinasadyang hindi ginagamit ang `buttonPrimary` dito: column ang success
  // card, kaya ang `flex: 1` noon ay nagpapaliit ng taas ng button sa zero.
  successButton: {
    alignSelf: 'stretch',
    backgroundColor: Colors.primary,
  },
});
