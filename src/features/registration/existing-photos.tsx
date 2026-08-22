import { createContext, useContext, useMemo } from 'react';

import { fieldsOfStep, type StepDef } from '@/components/form/types';
import { recordPhotoUrl } from '@/lib/api';

/** Pangalan ng field patungo sa URL ng naka-upload nang larawan. */
export type ExistingPhotos = Record<string, string>;

/**
 * Aling mga larawan ang naka-upload na para sa talang ito.
 *
 * KAAKIBAT ITO NG `buildValues`, HINDI KAPALIT.
 *
 * Sinasadyang nilalaktawan ng buildValues ang mga field na larawan: path ang
 * hawak ng server, hindi file, at kapag ipinadala iyon pabalik ay tatanggihan
 * ito ng panuntunang `image` at magiging 422 ang buong pag-save. Kaya hiwalay
 * na dinadala ang mga dating litrato — para lang ipakita. Hindi sila kailanman
 * nagiging sagot sa form, kaya hindi rin sila umaabot sa payload.
 *
 * Ang laman ng column ay isang path ("resident-photos/abc.jpg") na hindi
 * mabubuksan nang tuwiran; ginagawa itong URL ng endpoint na may token.
 *
 * ANG MGA LARAWAN SA LOOB NG REPEATER AY HINDI KASAMA. Ang sagot ng repeater
 * ay walang dalang id ng talang pinanggalingan, kaya ang tanging paraan ng
 * pagtutugma ay ang pagkakasunod-sunod — at sa sandaling magbura ng isang
 * entry ang gumagamit, ibang litrato na ang ipapakita sa entry na natira.
 * Mas mabuti ang walang ipinapakita kaysa maling ipinapakita.
 */
export function existingPhotos(
  steps: StepDef[],
  record: Record<string, unknown> | null,
  type: 'resident' | 'household' | 'family',
  recordId: number | null
): ExistingPhotos {
  // Sa residente at sambahayan lang may larawan. Walang sariling litrato ang
  // pamilya — ang pangkat lang ito ng mga residente.
  if (!record || !recordId || type === 'family') return {};

  const photos: ExistingPhotos = {};

  for (const field of steps.flatMap(fieldsOfStep)) {
    if (field.type !== 'image') continue;

    const raw = record[field.name];

    if (typeof raw !== 'string' || raw.trim() === '') continue;

    photos[field.name] = recordPhotoUrl(type, recordId, field.name);
  }

  return photos;
}

/*
  Konteksto, hindi props.

  Ang mga larawan ay nasa loob ng ImageField, na nasa loob ng FieldRenderer,
  na nasa loob ng FormSection — at sa kaso ng repeater, umiikot pa ito pabalik
  sa sarili nito. Ang pagpasa ng isang mapa sa bawat antas na iyon ay
  nangangahulugang bagong prop sa apat na component na walang ibang gagawin
  doon kundi ipasa ito sa susunod.
*/
const ExistingPhotoContext = createContext<ExistingPhotos>({});

export function ExistingPhotoProvider({
  photos,
  children,
}: {
  photos: ExistingPhotos;
  children: React.ReactNode;
}) {
  // Bagong object kada render ang mapa, kaya sa laman nito nakasandal ang
  // memo — kung hindi, muling nagre-render ang bawat larawan sa bawat titik
  // na itinatatak sa form.
  const key = Object.entries(photos)
    .map(([name, url]) => `${name}=${url}`)
    .sort()
    .join('|');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => photos, [key]);

  return <ExistingPhotoContext.Provider value={value}>{children}</ExistingPhotoContext.Provider>;
}

/** URL ng dating larawan ng field na ito, kung meron. */
export function useExistingPhoto(name: string): string | null {
  return useContext(ExistingPhotoContext)[name] ?? null;
}
