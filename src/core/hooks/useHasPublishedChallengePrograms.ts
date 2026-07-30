import { useEffect, useState } from 'react';
import { listPublishedChallengePrograms } from '../utils/challengeResponsesApi';

type CacheEntry = {
  value: boolean;
  at: number;
};

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<boolean>>();
let cacheGeneration = 0;
const invalidateListeners = new Set<() => void>();

/** Clear cached nav visibility after publish/unpublish-style changes. */
export function invalidatePublishedChallengeNavCache(spaceId?: string): void {
  if (spaceId) {
    cache.delete(spaceId);
    inflight.delete(spaceId);
  } else {
    cache.clear();
    inflight.clear();
  }
  cacheGeneration += 1;
  for (const listener of invalidateListeners) {
    listener();
  }
}

async function fetchHasPublished(spaceId: string): Promise<boolean> {
  const cached = cache.get(spaceId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  const existing = inflight.get(spaceId);
  if (existing) return existing;

  const promise = listPublishedChallengePrograms(spaceId)
    .then((programs) => {
      const value = programs.length > 0;
      cache.set(spaceId, { value, at: Date.now() });
      return value;
    })
    .catch(() => {
      // Prefer hidden on error / RLS deny — do not leak drafts via alternate APIs.
      cache.set(spaceId, { value: false, at: Date.now() });
      return false;
    })
    .finally(() => {
      inflight.delete(spaceId);
    });

  inflight.set(spaceId, promise);
  return promise;
}

/**
 * Whether the challenge nav entry should show for the active space.
 * Hidden until a successful published-program check returns true for that space.
 * Uses listPublishedChallengePrograms (RLS-backed; published only).
 */
export function useHasPublishedChallengePrograms(
  spaceId: string | null | undefined,
  enabled: boolean,
): boolean {
  const trimmedId = spaceId?.trim() || '';
  const [generation, setGeneration] = useState(cacheGeneration);
  const [result, setResult] = useState<{
    spaceId: string;
    value: boolean;
    generation: number;
  } | null>(null);

  useEffect(() => {
    const onInvalidate = () => setGeneration(cacheGeneration);
    invalidateListeners.add(onInvalidate);
    return () => {
      invalidateListeners.delete(onInvalidate);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !trimmedId) {
      return;
    }

    let cancelled = false;
    void fetchHasPublished(trimmedId).then((value) => {
      if (!cancelled) {
        setResult({ spaceId: trimmedId, value, generation });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [trimmedId, enabled, generation]);

  if (!enabled || !trimmedId) return false;
  // Prefer hidden while loading, after space switch, or after cache invalidation.
  if (
    !result ||
    result.spaceId !== trimmedId ||
    result.generation !== generation
  ) {
    return false;
  }
  return result.value;
}
