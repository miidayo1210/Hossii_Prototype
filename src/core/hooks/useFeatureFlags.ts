import { useState, useEffect, useRef } from 'react';
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
};

function getCached(spaceId: string): FeatureFlags | null {
  const entry = cache.get(spaceId);
  if (entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS) return entry.flags;
  return null;
}

// スペースIDが変わるたびに Feature Flag をフェッチ＆キャッシュする Hook。
// 初期値はキャッシュまたはデフォルト値なので、フェッチ完了前でも安全に読める。
export function useFeatureFlags(spaceId: string | undefined): UseFeatureFlagsResult {
  const [flags, setFlags] = useState<FeatureFlags>(() =>
    spaceId ? (getCached(spaceId) ?? DEFAULT_FLAGS) : DEFAULT_FLAGS
  );
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!spaceId) return;

    // キャッシュが有効なら再フェッチしない
    if (getCached(spaceId)) return;

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
  }, [spaceId]);

  return { flags };
}

// キャッシュを手動でクリアする（フラグ更新後に呼ぶ）
export function invalidateFeatureFlagsCache(spaceId?: string): void {
  if (spaceId) {
    cache.delete(spaceId);
  } else {
    cache.clear();
  }
}
