import { MAX_BACKGROUND_IMAGES } from '../../core/types/space';

export function appendSavedBackgroundUrl(
  urls: string[] | undefined,
  newUrl: string,
  max = MAX_BACKGROUND_IMAGES,
): string[] {
  const list = urls ?? [];
  if (list.includes(newUrl)) return list;
  if (list.length >= max) return list;
  return [...list, newUrl];
}
