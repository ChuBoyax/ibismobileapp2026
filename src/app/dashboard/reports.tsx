import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_HEIGHT } from '@/components/animated-tab-bar';
import { BarList, Hero, Section, SplitBar, StatPair } from '@/components/chart';
import { FilterBar } from '@/components/filter-bar';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { ApiError, reports, type ReportData, type ReportFilters } from '@/lib/api';
import { getCache, putCache, reportCacheKey } from '@/lib/db';
import { relativeTime } from '@/lib/format';
import { handleAuthError } from '@/lib/session';

const num = (value: number) => value.toLocaleString();

/**
 * Binabasa ang naka-save na ulat para sa isang kombinasyon ng filter.
 *
 * MAY ATRAS SA LUMANG SUSI. Noong iisa pa ang susi ng ulat ("reports"),
 * doon naitago ang lahat. Nang gawin itong per-filter, naulila ang mga
 * iyon — nandiyan pa sa cellphone, hindi na lang mahanap, kaya biglang
 * blangko ang ulat ng mga taong may laman naman pala.
 *
 * Ang atras ay para sa walang filter lamang: iyon lang ang tiyak nating
 * katumbas ng lumang naka-save. Sa may filter, mas mabuting walang ipakita
 * kaysa ipakita ang bilang ng buong barangay na may nakasulat na purok.
 */
async function readReportCache(filters: ReportFilters) {
  const exact = await getCache<ReportData>(reportCacheKey(filters));
  if (exact) return exact;

  const hasFilter = Object.values(filters).some((value) => value !== null && value !== undefined);
  if (hasFilter) return null;

  return getCache<ReportData>(LEGACY_REPORT_KEY);
}

/** Ang susi noong hindi pa hiwalay kada filter ang ulat. */
const LEGACY_REPORT_KEY = 'reports';

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<ReportData | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /** Muling pagkuha dahil nagpalit ng filter — hindi tinatanggal ang laman. */
  const [reloading, setReloading] = useState(false);

  const mounted = useRef(true);

  const load = useCallback(async (active: ReportFilters, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setReloading(true);

    // Sariling susi kada kombinasyon ng filter. Ang ulat ay buod na bilang,
    // hindi hilaw na tala — hindi ito kayang salain dito, kaya ang bawat
    // kombinasyon ay hiwalay na itinatago.
    const key = reportCacheKey(active);

    // Laman muna, saka pagsasariwa — para agad may makita kahit walang signal.
    if (!isRefresh) {
      const saved = await readReportCache(active);

      if (saved && mounted.current) {
        setData(saved.value);
        setError('');
        setLoading(false);
      }
    }

    try {
      const result = await reports(active);
      if (!mounted.current) return;

      setData(result);
      setError('');
      putCache(key, result);
    } catch (err) {
      if (await handleAuthError(err)) return;

      const cached = await readReportCache(active);
      if (!mounted.current) return;

      if (cached) {
        setData(cached.value);
        setError('');
        return;
      }

      // Walang naka-save para sa kombinasyong ito. Sinasabi nang tuwiran
      // imbes na ipakita ang bilang ng ibang salain — ang numerong mukhang
      // totoo pero mali ay mas mapanganib kaysa sa walang numero.
      const filtered = Object.values(active).some((value) => value !== null && value !== undefined);

      setData(null);
      setError(
        filtered
          ? 'This filter has not been opened on this device yet. Connect to load it.'
          : `${
              err instanceof ApiError ? err.message : 'Could not load the report.'
            } No saved report on this device yet.`
      );
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
        setReloading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      load(filters);

      return () => {
        mounted.current = false;
      };
    }, [load, filters])
  );

  /** Ang pagpapalit ng filter ay nag-uudyok ng bagong pagkuha. */
  function setFilter(key: keyof ReportFilters, value: string | number | null) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const population = data?.population;
  const households = data?.households;
  const families = data?.families;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScreenHeader title="Reports" subtitle={data?.barangays.join(' · ') || 'Barangay statistics'} />

      {!!data && (
        <FilterBar
          groups={[
            ...(data.filters.barangays.length > 0
              ? [
                  {
                    key: 'barangay_id',
                    label: 'Barangay',
                    selected: filters.barangay_id ?? null,
                    onSelect: (value: string | number | null) => setFilter('barangay_id', value),
                    options: [
                      { value: null, label: 'All barangays' },
                      ...data.filters.barangays.map((b) => ({ value: b.id, label: b.label })),
                    ],
                  },
                ]
              : []),
            {
              key: 'purok_id',
              label: 'Purok',
              selected: filters.purok_id ?? null,
              onSelect: (value) => setFilter('purok_id', value),
              options: [
                { value: null, label: 'All puroks' },
                ...data.filters.puroks.map((p) => ({ value: p.id, label: p.label })),
              ],
            },
            {
              key: 'sex',
              label: 'Sex',
              selected: filters.sex ?? null,
              onSelect: (value) => setFilter('sex', value),
              options: [
                { value: null, label: 'All' },
                ...data.filters.sexes.map((s) => ({ value: s, label: s })),
              ],
            },
            {
              key: 'age_group',
              label: 'Age',
              selected: filters.age_group ?? null,
              onSelect: (value) => setFilter('age_group', value),
              options: [
                { value: null, label: 'All ages' },
                ...data.filters.age_groups.map((g) => ({ value: g.key, label: g.label })),
              ],
            },
          ]}
          onClear={() => setFilters({})}
        />
      )}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(filters, true)}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }>
        {!!error && (
          <Pressable style={styles.banner} onPress={() => load(filters)}>
            <Ionicons name="cloud-offline-outline" size={18} color={Colors.danger} />
            <View style={styles.flex}>
              <Text style={styles.bannerTitle}>{error}</Text>
              <Text style={styles.bannerHint}>Tap to retry</Text>
            </View>
          </Pressable>
        )}

        {loading && !data ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>Compiling the report…</Text>
          </View>
        ) : !population ? null : (
          // Habang kinukuha ang bagong salain, hawak pa rin nito ang dating
          // laman — dumidilim lang. Walang biglang blangko, walang lundag.
          <View style={reloading && styles.reloading} pointerEvents={reloading ? 'none' : 'auto'}>
            {/* ── Populasyon ─────────────────────────────────────────── */}
            <Section
              title="Population"
              subtitle="Active residents currently living in the barangay">
              <Hero
                value={num(population.total)}
                label="Total population"
                hint={
                  population.average_age !== null
                    ? `Average age ${population.average_age} years`
                    : undefined
                }
              />

              <StatPair
                items={[
                  { label: 'Households', value: num(households?.total ?? 0) },
                  { label: 'Families', value: num(families?.total ?? 0) },
                  {
                    label: 'Avg. per household',
                    value: households?.average_size !== null && households?.average_size !== undefined
                      ? String(households.average_size)
                      : '—',
                  },
                ]}
              />
            </Section>

            <Section title="Sex distribution">
              <SplitBar data={population.sex} />
            </Section>

            <Section title="Age groups" subtitle="Based on recorded dates of birth">
              <BarList data={population.age_groups} total={population.total} showPercent />
            </Section>

            <Section title="Registered voters">
              <Hero
                value={`${population.voters.percent}%`}
                label="Of voting-age residents"
                hint={`${num(population.voters.registered)} registered out of ${num(
                  population.voters.voting_age
                )} aged 18 and above`}
              />
            </Section>

            <Section title="Civil status">
              <BarList data={population.civil_status} total={population.total} showPercent />
            </Section>

            <Section title="Residents per purok">
              <BarList data={population.purok} total={population.total} showPercent />
            </Section>

            {/* ── Sektor ────────────────────────────────────────────── */}
            <Section
              title="Sectoral groups"
              subtitle="Counted among active residents; a person may belong to more than one">
              <BarList data={data.sectors} total={population.total} showPercent />
            </Section>

            {/* ── Kabahayan ─────────────────────────────────────────── */}
            {!!households && (
              <>
                <Section
                  title="Housing conditions"
                  subtitle={`Share of the ${num(households.total)} recorded households`}>
                  <BarList data={households.utilities} showPercent />
                </Section>

                <Section title="Home ownership">
                  <BarList data={households.ownership} total={households.total} showPercent />
                </Section>

                <Section title="House type">
                  <BarList data={households.house_type} total={households.total} showPercent />
                </Section>
              </>
            )}

            {/* ── Pamilya ───────────────────────────────────────────── */}
            {!!families && (
              <>
                <Section title="Family income levels">
                  <BarList data={families.income_levels} total={families.total} showPercent />
                </Section>

                <Section title="Family types">
                  <BarList data={families.types} total={families.total} showPercent />
                </Section>
              </>
            )}

            {/* ── Registry ──────────────────────────────────────────── */}
            <Section
              title="Registry status"
              subtitle="All records ever filed, including those no longer counted above">
              <BarList data={population.registry_status} />
            </Section>

            <Text style={styles.footer}>
              Generated {relativeTime(data.generated_at)}
              {data.barangays.length > 0 ? ` · ${data.barangays.join(', ')}` : ''}
            </Text>
          </View>
        )}
      </ScrollView>
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
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
  },
  loading: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl * 2,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.muted,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerLight,
  },
  bannerTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.danger,
  },
  bannerHint: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.danger,
  },
  reloading: {
    opacity: 0.45,
  },
  footer: {
    marginTop: Spacing.xl,
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
});

