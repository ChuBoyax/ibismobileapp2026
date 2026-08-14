import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Icon sa kanan — kadalasan search o filter. Dekorasyon lang muna. */
  action?: React.ComponentProps<typeof Ionicons>['name'];
};

/** Green na header na ginagamit ng lahat ng screen sa loob ng dashboard tabs. */
export function ScreenHeader({ title, subtitle, action }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {!!action && (
          <View style={styles.actionButton}>
            <Ionicons name={action} size={19} color={Colors.onPrimary} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  flex: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.onPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
    color: Colors.primaryLight,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.onPrimaryFaded,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
