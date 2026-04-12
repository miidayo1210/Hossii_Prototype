import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { getFeatureFlagsForSpace, type FeatureFlags } from '../utils/featureFlagsApi';

export type UseFeatureFlagsResult = {
  flags: FeatureFlags;
};

// メモリキャッシュ（SWR/React Query が未導入のためシンプルなインメモリキャッシュで代替）
const cache = new Map<string, { flags: FeatureFlags; fetchedAt: number }>();
const CACHE_TTL_MS = 60_000; // 1分

const DEFAULT_FLAGS: FeatureFlags = {
  comments_thumbnail: true,
  likes_enabled: false,
  random_recall_enabled: false,
  public_board_mode: false,
  zine_export_enabled: false,
  space_canvas_export_enabled: false,
  bubble_shapes_extended: false,
  position_selector: false,
};

function getCached(spaceId: string): FeatureFlags | null {
  const entry = cache.get(spaceId);
  if (entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS) return entry.flags;
  return null;
}

// invalidate 時に購読者へ通知（同一 spaceId でも effect を再実行させる）
let invalidateVersion = 0;
const invalidateListeners = new Set<() => void>();

function subscribeInvalidate(onStoreChange: () => void) {
  invalidateListeners.add(onStoreChange);
  return () => invalidateListeners.delete(onStoreChange);
}

function getInvalidateVersion() {
  return invalidateVersion;
}

function getServerInvalidateSnapshot() {
  return 0;
}

function bumpInvalidateVersion() {
  invalidateVersion += 1;
  invalidateListeners.forEach((fn) => fn());
}

// スペースIDが変わるたびに Feature Flag をフェッチ＆キャッシュする Hook。
// 初期値はキャッシュまたはデフォルト値なので、フェッチ完了前でも安全に読める。
export function useFeatureFlags(spaceId: string | undefined): UseFeatureFlagsResult {
  const invalidateTick = useSyncExternalStore(
    subscribeInvalidate,
    getInvalidateVersion,
    getServerInvalidateSnapshot
  );
  const [flags, setFlags] = useState<FeatureFlags>(() =>
    spaceId ? (getCached(spaceId) ?? DEFAULT_FLAGS) : DEFAULT_FLAGS
  );
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!spaceId) return;

    const cached = getCached(spaceId);
    if (cached) {
      // スペース切替時はキャッシュを即 state に反映（非同期だと古い spaceId で上書きし得る）
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFlags(cached);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    getFeatureFlagsForSpace(spaceId)
      .then((result) => {
        if (controller.signal.aborted) return;
        cache.set(spaceId, { flags: result, fetchedAt: Date.now() });
        setFlags(result);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.warn('[useFeatureFlags] fetch failed', err);
        }
      });

    return () => {
      controller.abort();
    };
  }, [spaceId, invalidateTick]);

  return { flags };
}

// キャッシュを手動でクリアする（フラグ更新後に呼ぶ）
export function invalidateFeatureFlagsCache(spaceId?: string): void {
  if (spaceId) {
    cache.delete(spaceId);
  } else {
    cache.clear();
  }
  bumpInvalidateVersion();
}
