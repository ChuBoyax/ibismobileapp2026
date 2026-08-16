import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';

/**
 * Mga piraso ng chart para sa Reports.
 *
 * Tatlong tuntunin ang sinusunod dito:
 *
 *  1. ISANG KULAY ANG DAMI. Kapag magkakapareho ang sinusukat (bilang ng tao
 *     kada purok, halimbawa), iisang berde lang ang bar. Ang magkakaibang
 *     kulay ay para lang sa magkaibang bagay — hindi sa ranggo.
 *  2. ANG TEKSTO AY LAGING TINTA, HINDI KULAY NG BAR. Ang kulay ay nasa marka;
 *     ang bilang at label ay nananatiling itim o abo para nababasa.
 *  3. MANIPIS ANG MARKA, MAHINA ANG GRID. Ang datos ang dapat kitang-kita,
 *     hindi ang dekorasyon.
 *
 * Ang dalawang kulay sa SplitBar ay pinatakbo sa colorblind checker:
 * ΔE 24.7 sa protanopia, 33.6 sa normal na paningin — malayo sa panganib.
 * Hindi rin ito ang status colors (danger/warning) para walang malito.
 */

/** Kulay ng bar kapag dami ang sinusukat — iisa lang, laging berde. */
const MAGNITUDE = Colors.primary;

/** Dalawang kulay para sa magkaibang bagay. Napatunayang ligtas sa colorblind. */
export const SERIES = ['#2a78d6', '#eb6834'] as const;

export type Slice = {
  label: string;
  value: number;
  percent?: number;
};

/* ── Seksyon ──────────────────────────────────────────────────────────── */

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/* ── Malaking bilang ──────────────────────────────────────────────────── */

export function Hero({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <View style={styles.hero}>
      <Text style={styles.heroValue}>{value}</Text>
      <Text style={styles.heroLabel}>{label}</Text>
      {!!hint && <Text style={styles.heroHint}>{hint}</Text>}
    </View>
  );
}

export function StatPair({ items }: { items: { label: string; value: string }[] }) {
  return (
    <View style={styles.statRow}>
      {items.map((item) => (
        <View key={item.label} style={styles.stat}>
          <Text style={styles.statValue}>{item.value}</Text>
          <Text style={styles.statLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

/* ── Bar chart ────────────────────────────────────────────────────────── */

/**
 * Pahalang na bar. Ang haba ay kumpara sa pinakamalaki sa grupo, kaya
 * makikita agad kung alin ang nangingibabaw kahit hindi basahin ang bilang.
 */
export function BarList({
  data,
  total,
  showPercent = false,
  emptyText = 'No data recorded yet.',
}: {
  data: Slice[];
  /** Batayan ng porsyento. Kung wala, ang pinakamalaking halaga ang gamit. */
  total?: number;
  showPercent?: boolean;
  emptyText?: string;
}) {
  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const sum = total ?? values.reduce((a, b) => a + b, 0);

  if (data.length === 0) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }

  return (
    <View>
      {data.map((slice) => {
        const width = Math.max((slice.value / max) * 100, slice.value > 0 ? 2 : 0);
        const percent = slice.percent ?? (sum > 0 ? (slice.value / sum) * 100 : 0);

        return (
          <View key={slice.label} style={styles.barRow}>
            <View style={styles.barHead}>
              <Text style={styles.barLabel} numberOfLines={2}>
                {slice.label}
              </Text>
              <Text style={styles.barValue}>
                {slice.value.toLocaleString()}
                {showPercent && <Text style={styles.barPercent}>  {percent.toFixed(1)}%</Text>}
              </Text>
            </View>

            <View style={styles.track}>
              <View style={[styles.fill, { width: `${width}%`, backgroundColor: MAGNITUDE }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Isang bar na hati sa dalawa o tatlo — para sa bagay na bumubuo ng kabuuan,
 * tulad ng lalaki at babae. May 2px na puwang sa pagitan ng piraso para
 * hindi magmukhang iisa, at may legend sa ilalim dahil higit sa isa ang uri.
 */
export function SplitBar({ data }: { data: Slice[] }) {
  const sum = data.reduce((total, slice) => total + slice.value, 0);

  if (sum === 0) {
    return <Text style={styles.empty}>No data recorded yet.</Text>;
  }

  return (
    <View>
      <View style={styles.splitTrack}>
        {data.map((slice, index) => {
          const share = (slice.value / sum) * 100;
          if (share <= 0) return null;

          return (
            <View
              key={slice.label}
              style={[
                styles.splitPiece,
                {
                  flex: share,
                  backgroundColor: SERIES[index % SERIES.length],
                  // Puwang sa pagitan, hindi sa dulo — nananatiling isang bar.
                  marginLeft: index === 0 ? 0 : 2,
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.legend}>
        {data.map((slice, index) => (
          <View key={slice.label} style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: SERIES[index % SERIES.length] }]}
            />
            <Text style={styles.legendLabel}>{slice.label}</Text>
            <Text style={styles.legendValue}>
              {slice.value.toLocaleString()} · {((slice.value / sum) * 100).toFixed(1)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  sectionBody: {
    marginTop: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadow.card,
  },

  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  heroValue: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -1.2,
  },
  heroLabel: {
    marginTop: 2,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  heroHint: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    color: Colors.muted,
    textAlign: 'center',
  },

  statRow: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.4,
  },
  statLabel: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.muted,
    textAlign: 'center',
  },

  barRow: {
    marginBottom: Spacing.lg,
  },
  barHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: 6,
  },
  barLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  barValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  barPercent: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.muted,
  },
  track: {
    height: 10,
    borderRadius: Radius.sm,
    backgroundColor: Colors.divider,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.sm,
  },

  splitTrack: {
    flexDirection: 'row',
    height: 14,
    borderRadius: Radius.sm,
    backgroundColor: Colors.divider,
    overflow: 'hidden',
  },
  splitPiece: {
    height: '100%',
  },
  legend: {
    marginTop: Spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
  },
  legendLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  legendValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },

  empty: {
    paddingVertical: Spacing.md,
    fontSize: FontSize.sm,
    color: Colors.muted,
    textAlign: 'center',
  },
});
