import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Pinapaliit ang larawan bago pa ito makapasok sa form.
 *
 * ANG SUKAT NG LARAWAN ANG NAGTATAKDA KUNG GAANO KATAGAL ANG SYNC. Ang
 * `quality` ng image picker ay tungkol sa pagpiga lamang — hindi nito
 * ginagalaw ang sukat, kaya ang kuha ng labindalawang megapixel na camera ay
 * nananatiling labindalawang megapixel at umaabot pa rin ng isa hanggang
 * dalawang megabyte. Sa isang daang tala, iyon ay daan-daang megabyte na
 * kailangang umakyat sa mahinang signal — at iyon ang tunay na dahilan kung
 * bakit umaabot ng kalahating oras ang pila, hindi ang bilang ng tala.
 *
 * Sa isang larawan ng residente o ng dokumento, ang labing-anim na raang pixel
 * sa pinakamahabang gilid ay sapat na para mabasa at makilala. Ang natitira ay
 * bigat na walang naidaragdag na impormasyon.
 *
 * DITO ITO GINAGAWA AT HINDI SA ORAS NG PAGPAPADALA. Ang paliitan sa oras ng
 * sync ay nangangahulugang isang daang larawan ang pipigain nang sabay-sabay
 * habang naghihintay ang tao. Dito, isang larawan lang kada kuha, at habang
 * nag-eencode pa siya ng iba pang field.
 */

/** Pinakamahabang gilid ng larawang ipinapadala. */
const MAX_EDGE = 1600;

/** Antas ng pagpiga ng JPEG. */
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

    // Kapag hindi alam ang sukat, hindi na ito hinuhulaan — ang pagpiga na
    // lang ang gagawin. Ang paliitin ang larawang hindi naman pala malaki ay
    // pagsira ng detalye nang walang napapala.
    if (longest > MAX_EDGE) {
      context.resize(width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE });
    }

    const image = await context.renderAsync();
    const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: COMPRESS });

    return result.uri;
  } catch {
    // MAS MABUTI ANG MALAKING LARAWAN KAYSA WALANG LARAWAN.
    //
    // Kung mabibigo ang pagpapaliit — kulang sa memorya, kakaibang format —
    // ang orihinal ang ipapadala. Mabagal iyon, pero mararating pa rin ang
    // server. Ang ihinto ang pag-attach dahil dito ay pagpapabalik sa tao sa
    // isang residenteng nasa harap niya kanina lang.
    return uri;
  }
}
