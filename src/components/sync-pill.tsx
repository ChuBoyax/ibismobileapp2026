import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useOfflineSession } from '@/lib/use-offline-session';
import { subscribe, type SyncState } from '@/lib/sync';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Estado ng sync sa header ng dashboard.
 *
 * Tahimik ito kapag walang dapat asikasuhin — hindi humihingi ng pansin ang
 * "lahat ay naipadala na". Kapansin-pansin lang ito kapag may naghihintay, at
 * pula lang kapag may kailangang gawin ang tao. Kung laging maingay ang
 * indicator, natututo ang user na huwag itong tingnan.
 *
 * Isang pagbubukod: ang berdeng "naipadala na". Iyon ang tanging patunay na
 * nakikita ng taong hindi nagbubukas ng Sync queue, kaya lumalabas ito —
 * pero pansamantala lang.
 */

/**
 * Gaano katagal nananatili ang berdeng abiso.
 *
 * Sapat para mabasa ng nakatingin, maikli para hindi maging permanenteng
 * palamuti. Ang tandang laging nakasindi ay natututong balewalain.
 */
const SUCCESS_MS = 8000;

export function SyncPill() {
  const [state, setState] = useState<SyncState | null>(null);
  const [celebrating, setCelebrating] = useState(0);
  const offlineSession = useOfflineSession();

  /*
    ANG BERDENG ABISO AY PANSAMANTALA.

    Ito ang tanging patunay na nakikita ng taong hindi nagbubukas ng Sync
    queue: naipadala nga ang inencode niya. Kung wala ito, ang tanging
    nakikita niya ay ang paglaho ng dilaw na bilang — kapareho ng hitsura ng
    talang tahimik na nawala.

    Hindi ito nananatili: ang dashboard ay hindi lugar ng permanenteng
    pagbati. Ang buong talaan ay nasa Sync queue para sa naghahanap.

    NASA LOOB NG SUBSCRIPTION ANG PAGTATAKDA, hindi sa katawan ng effect.
    Ang sync engine ay panlabas na sistema, at ang callback nito ang tamang
    lugar ng setState — ang gawin iyon sa katawan ng effect ay nagdudulot ng
    dagdag na render sa bawat pagbabago ng bilang.
  */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = subscribe((next) => {
      setState(next);

      if (next.running || next.justSynced === 0) return;

      setCelebrating(next.justSynced);

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setCelebrating(0), SUCCESS_MS);
    });

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!state) return null;

  // Sa offline na pagpasok, ang ReauthBanner na ang nagsasalita. Kung
  // magpapakita rin ang pill dito, dalawang tanda ang sabay na hihingi ng
  // pansin para sa iisang bagay — at iyon mismo ang nakakalito.
  if (offlineSession) return null;

  const { counts, running } = state;
  const waiting = counts.pending + counts.syncing;

  // Walang naiwan, walang tumatakbo, at walang katatapos lang — walang
  // dapat sabihin.
  if (counts.total === 0 && !running && celebrating === 0) return null;

  // Malawak ang uri para makapagpalit ng tono — magkakaiba ang literal na
  // hex ng bawat estilo, kaya hindi sila magkatugma kung babanggitin nang tuwid.
  let icon: IoniconName = 'cloud-upload-outline';
  let label = `${waiting} waiting to sync`;
  let tone: { backgroundColor: string } = styles.neutral;
  let textTone: { color: string } = styles.neutralText;

  // Ang berdeng tagumpay ay nauuna lang kapag wala nang natitira — kung may
  // naghihintay pa, iyon ang dapat makita, hindi ang natapos na.
  if (celebrating > 0 && counts.total === 0 && !running) {
    icon = 'checkmark-circle';
    label = `${celebrating} sent`;
    tone = styles.success;
    textTone = styles.successText;
  } else if (counts.conflicts > 0) {
    icon = 'git-compare-outline';
    label = `${counts.conflicts} needs your decision`;
    tone = styles.danger;
    textTone = styles.dangerText;
  } else if (counts.needsFix > 0) {
    icon = 'alert-circle';
    label = `${counts.needsFix} needs fixing`;
    tone = styles.danger;
    textTone = styles.dangerText;
  } else if (running) {
    icon = 'sync';
    label = waiting > 0 ? `Syncing ${waiting}…` : 'Syncing…';
    tone = styles.info;
    textTone = styles.infoText;
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.pill, tone, pressed && styles.pressed]}
      onPress={() => router.push('/sync')}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Ionicons name={icon} size={13} color={textTone.color} />
      <Text style={[styles.text, textTone]}>{label}</Text>
    </Pressable>
  );
}

/** Buong hanay para sa ilalim ng pangalan sa header. */
export function SyncPillRow() {
  return (
    <View style={styles.row}>
      <SyncPill />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
  },
  pressed: {
    opacity: 0.75,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  success: {
    backgroundColor: Colors.primaryLight,
  },
  successText: {
    color: Colors.primary,
  },
  neutral: {
    backgroundColor: Colors.warningLight,
  },
  neutralText: {
    color: Colors.warning,
  },
  info: {
    backgroundColor: Colors.infoLight,
  },
  infoText: {
    color: Colors.info,
  },
  danger: {
    backgroundColor: Colors.dangerLight,
  },
  dangerText: {
    color: Colors.danger,
  },
});
