import { useMemo, useState, useCallback } from 'react';
import type { Hossii } from '../../core/types';

const RECALL_THRESHOLD_DAYS = 7;

export type RecallResult = {
  recalled: Hossii | null;
  refresh: () => void;
  hasRecallable: boolean;
};

/**
 * ランダム想起フック
 * 7日以上前の投稿からランダムに1件返す。
 * random_recall_enabled が OFF の場合は null を返す。
 */
export function useRandomRecall(hossiis: Hossii[], enabled: boolean): RecallResult {
  const [refreshKey, setRefreshKey] = useState(0);

  const eligibleHossiis = useMemo(() => {
    if (!enabled) return [];
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - RECALL_THRESHOLD_DAYS);
    return hossiis.filter((h) => h.createdAt < threshold);
  }, [hossiis, enabled]);

  // refreshKey が変わるたびにランダム選択し直す
  const recalled = useMemo(() => {
    if (eligibleHossiis.length === 0) return null;
    const idx = Math.floor(Math.random() * eligibleHossiis.length);
    return eligibleHossiis[idx];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleHossiis, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return { recalled, refresh, hasRecallable: eligibleHossiis.length > 0 };
}

/**
 * 投稿日からの経過日数を「N日前」テキストに変換
 */
export function getDaysAgoLabel(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return '今日';
  if (diffDays === 1) return '昨日';
  if (diffDays < 7) return `${diffDays}日前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}ヶ月前`;
  return `${Math.floor(diffDays / 365)}年前`;
}
