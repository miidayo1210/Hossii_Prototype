import { supabase, isSupabaseConfigured } from '../supabase';
import type { Space } from '../types/space';
import type { Hossii } from '../types';
import type { BottleFrequency } from '../types/settings';
import { rowToHossii, type HossiiRow } from './hossiisApi';

export type BottlePayload = {
  hossii: Hossii;
  fromSpace: { id: string; name: string; spaceURL?: string };
};

// 配信間隔をミリ秒で返す
export function calcBottleIntervalMs(frequency: BottleFrequency): number {
  switch (frequency) {
    case '1d':    return 1 * 24 * 60 * 60 * 1000;
    case '3d-7d': return (Math.random() * 4 + 3) * 24 * 60 * 60 * 1000;
    case '2w':    return 14 * 24 * 60 * 60 * 1000;
    case '1m':    return 30 * 24 * 60 * 60 * 1000;
    case 'off':   return Infinity;
  }
}

// 隣人スペース一覧を取得（スペース情報ごと返す）
export async function fetchNeighbors(spaceId: string): Promise<Space[]> {
  if (!isSupabaseConfigured) return [];

  // まず隣人の space_id リストを取得
  const { data: neighborRows, error: neighborError } = await supabase
    .from('space_neighbors')
    .select('neighbor_space_id')
    .eq('space_id', spaceId);

  if (neighborError) {
    console.error('[neighborsApi] fetchNeighbors error:', neighborError);
    return [];
  }

  if (!neighborRows || neighborRows.length === 0) return [];

  const neighborIds = neighborRows.map((r) => r.neighbor_space_id as string);

  // スペース情報を取得
  const { data: spacesData, error: spacesError } = await supabase
    .from('spaces')
    .select('id, name, space_url, background, card_type, quick_emotions, is_private, created_at')
    .in('id', neighborIds);

  if (spacesError) {
    console.error('[neighborsApi] fetchNeighbors spaces error:', spacesError);
    return [];
  }

  if (!spacesData) return [];

  return spacesData.map((s) => ({
    id: s.id as string,
    name: s.name as string,
    spaceURL: (s.space_url as string | null) ?? undefined,
    background: (s.background as Space['background']) ?? undefined,
    cardType: ((s.card_type as string) === 'stamp' ? 'stamp' : 'constellation') as Space['cardType'],
    quickEmotions: (s.quick_emotions as Space['quickEmotions']) ?? [],
    isPrivate: (s.is_private as boolean | null) ?? false,
    createdAt: new Date(s.created_at as string),
  }));
}

// 隣人を追加（相互登録: A→B と B→A を両方 insert）
export async function addNeighbor(spaceId: string, neighborSpaceId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error: e1 } = await supabase
    .from('space_neighbors')
    .insert({ space_id: spaceId, neighbor_space_id: neighborSpaceId });

  // 23505 = unique_violation（すでに登録済み）は無視
  if (e1 && e1.code !== '23505') {
    console.error('[neighborsApi] addNeighbor error:', e1);
    throw e1;
  }

  const { error: e2 } = await supabase
    .from('space_neighbors')
    .insert({ space_id: neighborSpaceId, neighbor_space_id: spaceId });

  if (e2 && e2.code !== '23505') {
    console.error('[neighborsApi] addNeighbor reverse error:', e2);
    // 逆方向の失敗は警告にとどめ、主方向の登録は維持する
  }
}

// 隣人を削除（相互削除: A→B と B→A を両方 delete）
export async function removeNeighbor(spaceId: string, neighborSpaceId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error: e1 } = await supabase
    .from('space_neighbors')
    .delete()
    .eq('space_id', spaceId)
    .eq('neighbor_space_id', neighborSpaceId);

  if (e1) console.error('[neighborsApi] removeNeighbor error:', e1);

  const { error: e2 } = await supabase
    .from('space_neighbors')
    .delete()
    .eq('space_id', neighborSpaceId)
    .eq('neighbor_space_id', spaceId);

  if (e2) console.error('[neighborsApi] removeNeighbor reverse error:', e2);

  if (e1) throw e1;
}

// 隣スペースからランダムに 1 件を選ぶ
export function pickRandomNeighbor(neighbors: Space[]): Space {
  return neighbors[Math.floor(Math.random() * neighbors.length)];
}

// 直近の漂着日時を取得
export async function fetchLastDeliveredAt(spaceId: string): Promise<Date | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('bottle_deliveries')
    .select('delivered_at')
    .eq('space_id', spaceId)
    .order('delivered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[neighborsApi] fetchLastDeliveredAt error:', error);
    return null;
  }

  if (!data) return null;
  return new Date(data.delivered_at as string);
}

// 漂着記録を保存する
export async function recordBottleDelivery(
  spaceId: string,
  hossiiId: string,
  fromSpaceId: string,
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from('bottle_deliveries')
    .insert({ space_id: spaceId, hossii_id: hossiiId, from_space_id: fromSpaceId });

  if (error) {
    console.error('[neighborsApi] recordBottleDelivery error:', error);
  }
}

// 漂着メッセージを取得する（配信可能かチェックして隣スペースからランダムに 1 件取得）
export async function fetchNextBottle(
  spaceId: string,
  neighborSpaceIds: string[],
  frequency: BottleFrequency,
): Promise<BottlePayload | null> {
  if (!isSupabaseConfigured || neighborSpaceIds.length === 0 || frequency === 'off') return null;

  // 既に配信済みの hossii_id を取得
  const { data: delivered } = await supabase
    .from('bottle_deliveries')
    .select('hossii_id')
    .eq('space_id', spaceId);

  const deliveredIds = (delivered ?? []).map((d) => d.hossii_id as string);

  // 隣スペースをランダムに 1 件選択して未配信投稿を取得
  const shuffled = [...neighborSpaceIds].sort(() => Math.random() - 0.5);

  for (const fromSpaceId of shuffled) {
    const query = supabase
      .from('hossiis')
      .select('*')
      .eq('space_id', fromSpaceId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(100);

    const { data: hossiis, error } = await query;

    if (error || !hossiis || hossiis.length === 0) continue;

    const candidates = hossiis.filter(
      (h) => !deliveredIds.includes(h.id as string),
    ) as HossiiRow[];

    if (candidates.length === 0) continue;

    const picked = candidates[Math.floor(Math.random() * candidates.length)];

    // 元スペース情報を取得
    const { data: spaceData } = await supabase
      .from('spaces')
      .select('id, name, space_url')
      .eq('id', fromSpaceId)
      .maybeSingle();

    return {
      hossii: rowToHossii(picked),
      fromSpace: {
        id: fromSpaceId,
        name: (spaceData?.name as string | null) ?? fromSpaceId,
        spaceURL: (spaceData?.space_url as string | null) ?? undefined,
      },
    };
  }

  return null;
}

