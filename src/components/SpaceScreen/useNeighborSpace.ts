import { useState, useCallback, useEffect } from 'react';
import type { Space } from '../../core/types/space';
import type { Hossii } from '../../core/types';
import {
  fetchNeighbors,
  pickRandomNeighbor,
  fetchLastDeliveredAt,
  fetchNextBottle,
  calcBottleIntervalMs,
  type BottlePayload,
} from '../../core/utils/neighborsApi';
import { fetchHossiis } from '../../core/utils/hossiisApi';
import type { SpaceSettings } from '../../core/types/settings';

type UseNeighborSpaceProps = {
  activeSpaceId: string | null | undefined;
  visitingSpaceId: string | null | undefined;
  isVisiting: boolean;
  spaceSettings: SpaceSettings | null;
  setVisitingSpace: (id: string | null) => void;
};

/**
 * 隣人スペース・訪問モード・漂着メッセージボトルのデータ管理フック。
 */
export function useNeighborSpace({
  activeSpaceId,
  visitingSpaceId,
  isVisiting,
  spaceSettings,
  setVisitingSpace,
}: UseNeighborSpaceProps) {
  const [neighbors, setNeighbors] = useState<Space[]>([]);
  const [visitingHossiis, setVisitingHossiis] = useState<Hossii[]>([]);
  const [visitingSpaceInfo, setVisitingSpaceInfo] = useState<Space | null>(null);
  const [bottlePayload, setBottlePayload] = useState<BottlePayload | null>(null);

  // 隣人スペース一覧を読み込む
  useEffect(() => {
    if (!activeSpaceId) return;
    fetchNeighbors(activeSpaceId).then(setNeighbors);
  }, [activeSpaceId]);

  // 訪問モード: 訪問先スペースの hossiis と情報を読み込む
  useEffect(() => {
    if (!visitingSpaceId) {
      setVisitingHossiis([]);
      setVisitingSpaceInfo(null);
      return;
    }
    const found = neighbors.find((n) => n.id === visitingSpaceId);
    if (found) setVisitingSpaceInfo(found);

    fetchHossiis(visitingSpaceId).then(setVisitingHossiis);
  }, [visitingSpaceId, neighbors]);

  // 漂着メッセージ: スペース画面を開いたタイミングで配信チェック
  useEffect(() => {
    if (!activeSpaceId || isVisiting || neighbors.length === 0) return;
    const frequency = spaceSettings?.bottleFrequency ?? '3d-7d';
    if (frequency === 'off') return;

    const check = async () => {
      const lastDeliveredAt = await fetchLastDeliveredAt(activeSpaceId);
      const intervalMs = calcBottleIntervalMs(frequency);
      const now = Date.now();
      const lastMs = lastDeliveredAt ? lastDeliveredAt.getTime() : 0;

      if (now - lastMs < intervalMs) return;

      const neighborIds = neighbors.map((n) => n.id);
      const payload = await fetchNextBottle(activeSpaceId, neighborIds, frequency);
      if (payload) {
        setBottlePayload(payload);
      }
    };

    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpaceId, neighbors.length, spaceSettings?.bottleFrequency]);

  // ランダムな隣人スペースへワープ
  const handleWarp = useCallback(() => {
    if (neighbors.length === 0) return;
    const target = pickRandomNeighbor(neighbors);
    setVisitingSpace(target.id);
  }, [neighbors, setVisitingSpace]);

  /** 管理者がログ一覧から非表示にしたあと、訪問先リストを即座に更新する */
  const removeVisitingHossii = useCallback((id: string) => {
    setVisitingHossiis((prev) => prev.filter((h) => h.id !== id));
  }, []);

  return {
    neighbors,
    visitingHossiis,
    visitingSpaceInfo,
    bottlePayload,
    setBottlePayload,
    handleWarp,
    removeVisitingHossii,
  };
}
