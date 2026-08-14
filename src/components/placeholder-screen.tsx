import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type PlaceholderScreenProps = {
  title: string;
  subtitle: string;
  icon: IoniconName;
  message: string;
  action?: IoniconName;
};

/**
 * Pansamantalang laman ng mga tab na wala pang tunay na functionality.
 * Iisang hitsura lahat para pare-pareho ang dating ng app.
 */
export function PlaceholderScreen({
  title,
  subtitle,
  icon,
  message,
  action = 'search-outline',
}: PlaceholderScreenProps) {
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScreenHeader title={title} subtitle={subtitle} action={action} />

      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.iconRing}>
            <Ionicons name={icon} size={38} color={Colors.primary} />
          </View>

          <Text style={styles.heading}>Coming soon</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>UI preview</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  iconRing: {
    width: 84,
    height: 84,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  heading: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  message: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.3,
  },
});
