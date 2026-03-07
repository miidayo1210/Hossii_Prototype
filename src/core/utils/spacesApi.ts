import { supabase, isSupabaseConfigured } from '../supabase';
import type { Space, SpaceId } from '../types/space';
import type { EmotionKey } from '../types';

// Supabase の行型（snake_case）
type SpaceRow = {
  id: string;
  community_id?: string | null;
  space_url: string | null;
  name: string;
  card_type: string;
  quick_emotions: string[];
  background: unknown;
  saved_background_images: string[] | null;
  created_at: string;
  is_private?: boolean | null;
};

// SpaceRow → Space（camelCase）
function rowToSpace(row: SpaceRow): Space {
  return {
    id: row.id,
    spaceURL: row.space_url ?? undefined,
    name: row.name,
    cardType: row.card_type as Space['cardType'],
    quickEmotions: row.quick_emotions as EmotionKey[],
    background: row.background as Space['background'],
    savedBackgroundImages: row.saved_background_images ?? undefined,
    createdAt: new Date(row.created_at),
    isPrivate: row.is_private ?? undefined,
  };
}

// Space（camelCase）→ INSERT/UPDATE 用オブジェクト（snake_case）
function spaceToRow(space: Space): Omit<SpaceRow, 'created_at'> & { created_at?: string } {
  return {
    id: space.id,
    space_url: space.spaceURL ?? null,
    name: space.name,
    card_type: space.cardType,
    quick_emotions: space.quickEmotions,
    background: space.background ?? { kind: 'pattern', value: 'mist' },
    saved_background_images: space.savedBackgroundImages ?? null,
    created_at: space.createdAt.toISOString(),
  };
}

/**
 * コミュニティのスペース一覧を取得する。
 * - 成功時: Space[] を返す（0件の場合は空配列）
 * - エラー時: null を返す（呼び出し側で既存データを保持するかどうかを判断する）
 */
export async function fetchSpaces(communityId?: string): Promise<Space[] | null> {
  if (!isSupabaseConfigured) return [];

  let query = supabase
    .from('spaces')
    .select('*')
    .order('created_at', { ascending: true });

  if (communityId) {
    query = query.eq('community_id', communityId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[spacesApi] fetchSpaces error:', error.message);
    return null;
  }

  return (data as SpaceRow[]).map(rowToSpace);
}

export async function insertSpace(space: Space, communityId?: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const row = {
    ...spaceToRow(space),
    ...(communityId ? { community_id: communityId } : {}),
  };

  const { error } = await supabase.from('spaces').insert(row);
  if (error) {
    console.error('[spacesApi] insertSpace error:', error.message);
  }
}

export async function updateSpaceInDb(id: SpaceId, patch: Partial<Space>): Promise<void> {
  if (!isSupabaseConfigured) return;

  const updateObj: Partial<SpaceRow> = {};
  if (patch.spaceURL !== undefined) updateObj.space_url = patch.spaceURL ?? null;
  if (patch.name !== undefined) updateObj.name = patch.name;
  if (patch.cardType !== undefined) updateObj.card_type = patch.cardType;
  if (patch.quickEmotions !== undefined) updateObj.quick_emotions = patch.quickEmotions;
  if (patch.background !== undefined) updateObj.background = patch.background;
  if (patch.savedBackgroundImages !== undefined) updateObj.saved_background_images = patch.savedBackgroundImages ?? null;
  if (patch.isPrivate !== undefined) updateObj.is_private = patch.isPrivate ?? null;

  if (Object.keys(updateObj).length === 0) return;

  const { error } = await supabase.from('spaces').update(updateObj).eq('id', id);
  if (error) {
    console.error('[spacesApi] updateSpaceInDb error:', error.message);
  }
}

export async function deleteSpaceFromDb(id: SpaceId): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from('spaces').delete().eq('id', id);
  if (error) {
    console.error('[spacesApi] deleteSpaceFromDb error:', error.message);
  }
}

export async function fetchSpaceByUrl(spaceUrl: string): Promise<Space | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('spaces')
    .select('*')
    .eq('space_url', spaceUrl)
    .maybeSingle();

  if (error) {
    console.error('[spacesApi] fetchSpaceByUrl error:', error.message);
    return null;
  }

  return data ? rowToSpace(data as SpaceRow) : null;
}
