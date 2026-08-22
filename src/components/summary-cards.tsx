import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { RemotePhoto } from '@/components/remote-photo';
import { Colors, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { EMPTY, type SummaryEntry, type SummaryGroup } from '@/features/registration/build-summary';

type SummaryCardsProps = {
  groups: SummaryGroup[];
  /**
   * Kapag ibinigay, pindutan ang ulo ng bawat card at bumubukas ito sa
   * hakbang na iyon. Kapag wala, basahin lang — walang ipinapangakong
   * pagbabago ang hitsura nito.
   */
  onEditStep?: (index: number) => void;
};

/**
 * Ang buod ng isang tala, hati-hati ayon sa hakbang ng form.
 *
 * Iisang anyo sa dalawang lugar: sa review bago mag-save, at sa view page
 * pagbukas ng tala mula sa listahan. Sinasadya iyon — ang nakita ng
 * nag-eencode bago niya i-save ang siya ring makikita niya pagbalik, kaya
 * madali niyang matutunton kung saan nagkamali.
 */
export function SummaryCards({ groups, onEditStep }: SummaryCardsProps) {
  return (
    <>
      {groups.map((group) => {
        const header = (
          <>
            <View style={styles.iconRing}>
              <Ionicons name={group.icon} size={17} color={Colors.primary} />
            </View>
            <Text style={styles.title}>{group.title}</Text>
            {!!onEditStep && <Ionicons name="create-outline" size={18} color={Colors.primary} />}
          </>
        );

        return (
          <View key={group.title} style={styles.card}>
            {onEditStep ? (
              <Pressable
                style={styles.header}
                onPress={() => onEditStep(group.index)}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${group.title}`}>
                {header}
              </Pressable>
            ) : (
              <View style={styles.header}>{header}</View>
            )}

            {group.entries.map((entry) => (
              <SummaryRow key={entry.name} entry={entry} />
            ))}
          </View>
        );
      })}
    </>
  );
}

function SummaryRow({ entry }: { entry: SummaryEntry }) {
  if (entry.kind === 'text') {
    return (
      <View style={styles.row}>
        <Text style={styles.label}>{entry.label}</Text>
        <Text
          style={[styles.value, entry.display === EMPTY && styles.valueEmpty]}
          numberOfLines={2}>
          {entry.display}
        </Text>
      </View>
    );
  }

  /*
    ANG LARAWAN AY IPINAPAKITA, HINDI IPINAPAHAYAG.

    Ang buong dahilan ng pagsama nito rito ay para masagot ang tanong na
    "may naipasok ba akong litrato?" — at ang salitang "Uploaded" sa isang
    hanay ay hindi iyon sinasagot nang buo. Maaaring ang litrato ng ID ay
    malabo, o baling-baliktad, o ibang tao. Ang mismong larawan lang ang
    makakapagsabi.
  */
  if (!entry.uri) {
    return (
      <View style={styles.row}>
        <Text style={styles.label}>{entry.label}</Text>
        <Text style={[styles.value, styles.valueEmpty]}>No photo</Text>
      </View>
    );
  }

  return (
    <View style={styles.photoRow}>
      <View style={styles.photoHeader}>
        <Text style={styles.label}>{entry.label}</Text>
        {entry.uploaded && (
          <View style={styles.badge}>
            <Ionicons name="cloud-done-outline" size={13} color={Colors.primaryDark} />
            <Text style={styles.badgeLabel}>Uploaded</Text>
          </View>
        )}
      </View>

      <View style={styles.photoFrame}>
        {entry.uploaded ? (
          <RemotePhoto uri={entry.uri} label={entry.label} height={150} />
        ) : (
          <Image source={{ uri: entry.uri }} style={styles.photo} resizeMode="cover" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  iconRing: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  label: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.muted,
  },
  value: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
  },
  valueEmpty: {
    fontWeight: '400',
    color: Colors.border,
  },
  photoRow: {
    paddingVertical: Spacing.sm,
  },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  photoFrame: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  photo: {
    width: '100%',
    height: 150,
    backgroundColor: Colors.divider,
  },
});
