import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type Tone = 'up' | 'down' | 'flat';

// PEKENG DATOS — pang-UI lang muna. Papalitan ng galing sa API.
const STATS: {
  label: string;
  value: string;
  icon: IoniconName;
  tint: string;
  color: string;
  trend: string;
  tone: Tone;
}[] = [
  {
    label: 'Total Residents',
    value: '1,248',
    icon: 'people',
    tint: Colors.primaryLight,
    color: Colors.primary,
    trend: '+2.4%',
    tone: 'up',
  },
  {
    label: 'Families',
    value: '312',
    icon: 'person-add',
    tint: Colors.infoLight,
    color: Colors.info,
    trend: '+1.1%',
    tone: 'up',
  },
  {
    label: 'Households',
    value: '289',
    icon: 'home',
    tint: Colors.warningLight,
    color: Colors.warning,
    trend: '+0.8%',
    tone: 'up',
  },
  {
    label: 'Pending Requests',
    value: '7',
    icon: 'document-text',
    tint: Colors.dangerLight,
    color: Colors.danger,
    trend: '2 urgent',
    tone: 'flat',
  },
];

const QUICK_ACTIONS: { label: string; icon: IoniconName }[] = [
  { label: 'Add Resident', icon: 'person-add-outline' },
  { label: 'New Household', icon: 'home-outline' },
  { label: 'Generate Report', icon: 'document-text-outline' },
];

const ACTIVITY: { title: string; time: string; icon: IoniconName; tint: string; color: string }[] = [
  {
    title: 'New resident registered',
    time: 'Juan Dela Cruz · 10 minutes ago',
    icon: 'person-add',
    tint: Colors.primaryLight,
    color: Colors.primary,
  },
  {
    title: 'Barangay clearance requested',
    time: 'Maria Santos · 1 hour ago',
    icon: 'document-text',
    tint: Colors.infoLight,
    color: Colors.info,
  },
  {
    title: 'Household record updated',
    time: 'Purok 3 · 3 hours ago',
    icon: 'home',
    tint: Colors.warningLight,
    color: Colors.warning,
  },
  {
    title: 'Monthly population report generated',
    time: 'System · Yesterday',
    icon: 'bar-chart',
    tint: Colors.primaryLight,
    color: Colors.primary,
  },
];

const TREND_ICON: Record<Tone, IoniconName> = {
  up: 'trending-up',
  down: 'trending-down',
  flat: 'ellipse',
};

const TREND_COLOR: Record<Tone, string> = {
  up: Colors.primary,
  down: Colors.danger,
  flat: Colors.muted,
};

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!action && <Text style={styles.sectionAction}>{action}</Text>}
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <View style={styles.headerRow}>
            <View style={styles.seal}>
              <Image
                source={require('../../../assets/images/batologo-256.png')}
                style={styles.sealImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.flex}>
              <Text style={styles.greeting}>Good day,</Text>
              <Text style={styles.name}>Admin</Text>
            </View>

            <View style={styles.bell}>
              <Ionicons name="notifications-outline" size={20} color={Colors.onPrimary} />
              <View style={styles.bellDot} />
            </View>
          </View>

          <View style={styles.headerMeta}>
            <Ionicons name="location-outline" size={13} color={Colors.primaryLight} />
            <Text style={styles.headerMetaText}>Barangay Bato · Leyte</Text>
          </View>
        </View>

        {/* Umaangat ang content papasok sa header para lumutang ang mga card. */}
        <View style={styles.content}>
          <View style={styles.statGrid}>
            {STATS.map((stat) => (
              <View key={stat.label} style={styles.statCard}>
                <View style={styles.statTop}>
                  <View style={[styles.statIcon, { backgroundColor: stat.tint }]}>
                    <Ionicons name={stat.icon} size={18} color={stat.color} />
                  </View>
                  <View style={styles.trendRow}>
                    <Ionicons
                      name={TREND_ICON[stat.tone]}
                      size={stat.tone === 'flat' ? 6 : 12}
                      color={TREND_COLOR[stat.tone]}
                    />
                    <Text style={[styles.trendText, { color: TREND_COLOR[stat.tone] }]}>
                      {stat.trend}
                    </Text>
                  </View>
                </View>

                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <SectionTitle title="Quick Actions" />
          <View style={styles.actionRow}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.label}
                style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}>
                <View style={styles.actionIcon}>
                  <Ionicons name={action.icon} size={20} color={Colors.primary} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>

          <SectionTitle title="Recent Activity" action="See all" />
          <View style={styles.activityCard}>
            {ACTIVITY.map((item, index) => (
              <View
                key={item.title}
                style={[styles.activityRow, index === ACTIVITY.length - 1 && styles.lastRow]}>
                <View style={[styles.activityIcon, { backgroundColor: item.tint }]}>
                  <Ionicons name={item.icon} size={16} color={item.color} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.activityTitle}>{item.title}</Text>
                  <Text style={styles.activityTime}>{item.time}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.border} />
              </View>
            ))}
          </View>
        </View>
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
  scroll: {
    paddingBottom: Spacing.xxl,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    // Sobrang padding sa ilalim para may masakop ang umaangat na content.
    paddingBottom: Spacing.xxl + Spacing.xl,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  seal: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealImage: {
    width: 34,
    height: 34,
  },
  greeting: {
    fontSize: FontSize.sm,
    color: Colors.primaryLight,
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.onPrimary,
    letterSpacing: -0.3,
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.onPrimaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
  },
  headerMetaText: {
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
    letterSpacing: 0.2,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    marginTop: -Spacing.xxl,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statCard: {
    // Mababang basis para kasya pa rin ang gap sa makikitid na screen,
    // tapos flexGrow ang bahalang punuin ang natirang espasyo.
    flexBasis: '46%',
    flexGrow: 1,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statValue: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.6,
  },
  statLabel: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  sectionAction: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  actionCardPressed: {
    backgroundColor: Colors.primaryLight,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  activityCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    ...Shadow.card,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  activityTime: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
});
