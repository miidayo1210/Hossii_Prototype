import { isSupabaseConfigured } from '../supabase';
import type { SpacePane } from '../types/spacePane';
import { ensureDefaultSpacePane as ensureDefaultSpacePaneCore } from './spacePanesApi';

const inFlight = new Map<string, Promise<SpacePane | null>>();
const healFailedSpaceIds = new Set<string>();

/**
 * Idempotent client-side heal for default Pane existence.
 * DB trigger is authoritative; this is a safety net after space create/load.
 */
export async function ensureDefaultSpacePane(spaceId: string): Promise<SpacePane | null> {
  if (!isSupabaseConfigured) return null;
  if (!spaceId || healFailedSpaceIds.has(spaceId)) return null;

  const pending = inFlight.get(spaceId);
  if (pending) return pending;

  const promise = ensureDefaultSpacePaneCore(spaceId)
    .catch((err: unknown) => {
      console.warn('[ensureDefaultSpacePane] heal failed:', spaceId, err);
      healFailedSpaceIds.add(spaceId);
      return null;
    })
    .finally(() => {
      inFlight.delete(spaceId);
    });

  inFlight.set(spaceId, promise);
  return promise;
}

/** Fire-and-forget heal for multiple spaces (e.g. after fetchSpaces). */
export function healDefaultSpacePanes(spaceIds: string[]): void {
  if (!isSupabaseConfigured || spaceIds.length === 0) return;
  for (const spaceId of spaceIds) {
    void ensureDefaultSpacePane(spaceId);
  }
}

/** @internal Test helper */
export function resetEnsureDefaultSpacePaneState(): void {
  inFlight.clear();
  healFailedSpaceIds.clear();
}
