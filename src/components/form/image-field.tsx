import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type ImageFieldProps = {
  label: string;
  value: string | null;
  onChange: (uri: string | null) => void;
  hint?: string;
  required?: boolean;
  error?: string;
};

/**
 * Kuhanan ng larawan para sa mga field na FileUpload sa web.
 *
 * Camera muna bago gallery ang pagkakasunod dito: sa aktwal na pag-eencode,
 * nasa harap ng nag-eencode ang residente, kaya mas madalas na kukunan pa lang
 * ang larawan kaysa hahanapin sa telepono.
 */
export function ImageField({ label, value, onChange, hint, required, error }: ImageFieldProps) {
  async function pickFrom(source: 'camera' | 'library') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        source === 'camera'
          ? 'Payagan ang camera para makakuha ng larawan.'
          : 'Payagan ang photos para makapili ng larawan.'
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true })
        : await ImagePicker.launchImageLibraryAsync({
            quality: 0.6,
            allowsEditing: true,
            mediaTypes: ['images'],
          });

    if (!result.canceled && result.assets[0]) {
      onChange(result.assets[0].uri);
    }
  }

  function choose() {
    Alert.alert(label, 'Saan kukunin ang larawan?', [
      { text: 'Take photo', onPress: () => pickFrom('camera') },
      { text: 'Choose from gallery', onPress: () => pickFrom('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.asterisk}> *</Text>}
      </Text>

      {value ? (
        <View style={styles.preview}>
          <Image source={{ uri: value }} style={styles.image} resizeMode="cover" />

          <View style={styles.previewActions}>
            <Pressable style={styles.previewButton} onPress={choose} accessibilityRole="button">
              <Ionicons name="swap-horizontal-outline" size={17} color={Colors.primaryDark} />
              <Text style={styles.previewLabel}>Replace</Text>
            </Pressable>

            <Pressable
              style={styles.previewButton}
              onPress={() => onChange(null)}
              accessibilityRole="button">
              <Ionicons name="trash-outline" size={17} color={Colors.danger} />
              <Text style={[styles.previewLabel, styles.removeLabel]}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={[styles.dropzone, !!error && styles.dropzoneError]}
          onPress={choose}
          accessibilityRole="button"
          accessibilityLabel={`Add ${label}`}>
          <View style={styles.iconRing}>
            <Ionicons name="camera-outline" size={22} color={Colors.primary} />
          </View>
          <Text style={styles.dropzoneTitle}>Take photo or choose a file</Text>
          <Text style={styles.dropzoneHint}>JPG or PNG</Text>
        </Pressable>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}
      {!error && !!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  asterisk: {
    color: Colors.danger,
  },
  dropzone: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    gap: Spacing.xs,
  },
  dropzoneError: {
    borderColor: Colors.danger,
  },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  dropzoneTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  dropzoneHint: {
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  preview: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  image: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.divider,
  },
  previewActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  previewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  previewLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
  removeLabel: {
    color: Colors.danger,
  },
  hint: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  error: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    color: Colors.danger,
  },
});
