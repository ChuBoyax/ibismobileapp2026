import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const MAX_EDGE = 1600;
const COMPRESS = 0.7;

/**
 * @param uri Ang larawang galing sa camera o gallery.
 * @param size Sukat ng orihinal, kung alam — galing ito sa image picker.
 * @returns Ang bagong larawan, o ang orihinal kung nabigo ang pagpapaliit.
 */
export async function shrinkPhoto(
  uri: string,
  size?: { width?: number | null; height?: number | null }
): Promise<string> {
  try {
    const width = size?.width ?? 0;
    const height = size?.height ?? 0;
    const longest = Math.max(width, height);

    const context = ImageManipulator.manipulate(uri);

    if (longest > MAX_EDGE) {
      context.resize(width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE });
    }

    const image = await context.renderAsync();
    const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: COMPRESS });

    return result.uri;
  } catch {
    return uri;
  }
}
