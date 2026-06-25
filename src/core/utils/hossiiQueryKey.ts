import type { DisplayPeriod } from './displayPrefsStorage';

/** サーバー側フィルタ条件のハッシュ（初版は固定） */
export const SERVER_FILTER_HASH = 'v1';

export type HossiiQueryKey = `${string}:${DisplayPeriod}:${string}`;

export function buildQueryKey(
  spaceId: string,
  displayPeriod: DisplayPeriod,
  serverFilterHash: string = SERVER_FILTER_HASH,
): HossiiQueryKey {
  return `${spaceId}:${displayPeriod}:${serverFilterHash}`;
}
