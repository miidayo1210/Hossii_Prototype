import type { DisplayPeriod } from './displayPrefsStorage';
import type { Hossii } from '../types';
import type { HossiiEntitiesSlice } from './hossiiEntitiesState';
import { defaultSpacePaneId } from './spacePanesApi';

/** サーバー側フィルタ条件のハッシュ（初版は固定） */
export const SERVER_FILTER_HASH = 'v1';

export const QUERY_KEY_VERSION_V1 = 'v1';
export const QUERY_KEY_VERSION_V2 = 'v2';

/** v1 and v2 query keys (string form). */
export type HossiiQueryKey = string;

export type PaneQueryScope =
  | { kind: 'pane'; paneId: string }
  | { kind: 'all-panes' };

export type ParsedHossiiQueryKey = {
  spaceId: string;
  paneScope: PaneQueryScope;
  displayPeriod: DisplayPeriod;
  version: typeof QUERY_KEY_VERSION_V1 | typeof QUERY_KEY_VERSION_V2;
};

const VALID_PERIODS: DisplayPeriod[] = ['1d', '1w', '1m', 'all'];

function isDisplayPeriod(value: string): value is DisplayPeriod {
  return (VALID_PERIODS as string[]).includes(value);
}

export function buildQueryKey(
  spaceId: string,
  displayPeriod: DisplayPeriod,
  serverFilterHash: string = SERVER_FILTER_HASH,
): HossiiQueryKey {
  return `${spaceId}:${displayPeriod}:${serverFilterHash}`;
}

export function buildQueryKeyV2(
  spaceId: string,
  paneScope: PaneQueryScope,
  displayPeriod: DisplayPeriod,
): HossiiQueryKey {
  const paneSegment = paneScope.kind === 'all-panes' ? '*' : paneScope.paneId;
  return `${spaceId}:pane:${paneSegment}:${displayPeriod}:${QUERY_KEY_VERSION_V2}`;
}

export function parseQueryKey(key: string): ParsedHossiiQueryKey | null {
  if (!key || typeof key !== 'string') return null;

  const v2Match = key.match(/^(.+):pane:([^:]+):([^:]+):(v2)$/);
  if (v2Match) {
    const [, spaceId, paneSegment, period, version] = v2Match;
    if (!isDisplayPeriod(period)) return null;
    const paneScope: PaneQueryScope =
      paneSegment === '*'
        ? { kind: 'all-panes' }
        : { kind: 'pane', paneId: paneSegment };
    return {
      spaceId,
      paneScope,
      displayPeriod: period,
      version: version as typeof QUERY_KEY_VERSION_V2,
    };
  }

  const v1Match = key.match(/^(.+):([^:]+):(v1)$/);
  if (v1Match) {
    const [, spaceId, period] = v1Match;
    if (!isDisplayPeriod(period)) return null;
    return {
      spaceId,
      paneScope: { kind: 'all-panes' },
      displayPeriod: period,
      version: QUERY_KEY_VERSION_V1,
    };
  }

  return null;
}

type HossiiPaneRef = Pick<Hossii, 'spaceId' | 'spacePaneId'>;

/** Whether a hossii belongs to a parsed query key's pane scope. */
export function hossiiMatchesParsedQueryKey(
  hossii: HossiiPaneRef,
  parsed: ParsedHossiiQueryKey,
  defaultPaneId?: string,
): boolean {
  if (hossii.spaceId !== parsed.spaceId) return false;

  if (parsed.paneScope.kind === 'all-panes') {
    return true;
  }

  const resolvedDefault = defaultPaneId ?? defaultSpacePaneId(parsed.spaceId);
  const paneId = parsed.paneScope.paneId;

  if (paneId === resolvedDefault) {
    return hossii.spacePaneId === resolvedDefault;
  }

  return hossii.spacePaneId === paneId;
}

/** Existing ordered query keys that should receive an optimistic insert for this hossii. */
export function queryKeysForHossii(
  entities: HossiiEntitiesSlice,
  hossii: Hossii,
): HossiiQueryKey[] {
  const defaultPaneId = defaultSpacePaneId(hossii.spaceId);
  return Object.keys(entities.orderedIdsByQueryKey).filter((key) => {
    const parsed = parseQueryKey(key);
    if (!parsed) return false;
    return hossiiMatchesParsedQueryKey(hossii, parsed, defaultPaneId);
  });
}
