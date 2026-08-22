import { createContext, useContext, useMemo } from 'react';

import { fieldsOfStep, type StepDef } from '@/components/form/types';
import { recordPhotoUrl } from '@/lib/api';


export type ExistingPhotos = Record<string, string>;


export function existingPhotos(
  steps: StepDef[],
  record: Record<string, unknown> | null,
  type: 'resident' | 'household' | 'family',
  recordId: number | null
): ExistingPhotos {
 
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


const ExistingPhotoContext = createContext<ExistingPhotos>({});

export function ExistingPhotoProvider({
  photos,
  children,
}: {
  photos: ExistingPhotos;
  children: React.ReactNode;
}) {
 
  const key = Object.entries(photos)
    .map(([name, url]) => `${name}=${url}`)
    .sort()
    .join('|');

 
  const value = useMemo(() => photos, [key]);

  return <ExistingPhotoContext.Provider value={value}>{children}</ExistingPhotoContext.Provider>;
}


export function useExistingPhoto(name: string): string | null {
  return useContext(ExistingPhotoContext)[name] ?? null;
}
