import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, FontSize, Spacing } from '@/constants/theme';
import { photoHeaders } from '@/lib/api';

type RemotePhotoProps = {
  /** Buong URL ng larawan — tingnan ang `recordPhotoUrl`. */
  uri: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** Ipinapakita sa ilalim ng nabigong larawan, hal. "Resident Photo". */
  label?: string;
};

/**
 * Larawang nasa likod ng token.
 *
 * Hindi kayang basahin ng <Image> ang mga litrato ng RBI nang tuwiran: nasa
 * pribadong disk sila at Bearer token ang hinihingi ng endpoint. Kailangan
 * munang kunin ang token bago pa masimulan ang paghila, kaya may sandaling
 * wala pang maipapakita — iyon ang ipinapaliwanag ng spinner dito.
 *
 * MAY SARILING ESTADO ANG PAGKABIGO, at hindi ito blangko. Ang buong punto ng
 * pagpapakita ng dating larawan ay para malaman ng nag-eencode kung may
 * naka-upload na; ang tahimik na kawalan ay sinasagot ang tanong na iyon nang
 * mali. Kapag hindi makuha, sinasabi nitong may larawan pero hindi maabot —
 * iba iyon sa "walang larawan".
 */
export function RemotePhoto({ uri, height = 180, style, label }: RemotePhotoProps) {
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [shown, setShown] = useState(uri);

  useEffect(() => {
    let active = true;

    void photoHeaders().then((next) => {
      if (active) setHeaders(next);
    });

    return () => {
      active = false;
    };
  }, []);

  // Bagong larawan, bagong pagsubok — kung hindi, mananatili ang pulang
  // estado ng nakaraang uri kahit iba na ang ipinapakita. Sa render ito
  // ginagawa at hindi sa effect: iyon ang inirerekomendang paraan ng React sa
  // pag-reset ng estado kapag nagbago ang prop, at wala itong dagdag na
  // pagpinta sa screen bago maitama.
  if (shown !== uri) {
    setShown(uri);
    setFailed(false);
    setLoaded(false);
  }

  if (failed) {
    return (
      <View style={[styles.fallback, { height }, style]}>
        <Ionicons name="image-outline" size={22} color={Colors.muted} />
        <Text style={styles.fallbackTitle}>Cannot load this photo</Text>
        <Text style={styles.fallbackHint}>
          {label ? `${label} is saved on the server.` : 'The photo is saved on the server.'} Connect
          to the server to see it.
        </Text>
      </View>
    );
  }

  return (
    <View style={[{ height }, style]}>
      {!!headers && (
        <Image
          source={{ uri, headers }}
          style={styles.image}
          resizeMode="cover"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}

      {!loaded && (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.divider,
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.divider,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.background,
  },
  fallbackTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  fallbackHint: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
