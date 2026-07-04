import { supabase, isSupabaseConfigured } from '../supabase';
import type { Space, SpaceId } from '../types/space';
import type { EmotionKey } from '../types';
import { parseCustomEmotionsFromJson, parseDecorationsFromJson } from './spaceDecorations';
import { parseTabFolders } from './tabFolderStorage';
import { ensureDefaultSpacePane } from './ensureDefaultSpacePane';

// Supabase の行型（snake_case）
type SpaceRow = {
  id: string;
  community_id?: string | null;
  space_url: string | null;
  name: string;
  quick_emotions: string[];
  background: unknown;
  saved_background_images: string[] | null;
  created_at: string;
  is_private?: boolean | null;
  preset_tags?: string[] | null;
  welcome_message?: string | null;
  description?: string | null;
  character_name?: string | null;
  decorations?: unknown;
  character_image_url?: string | null;
  custom_emotions?: unknown;
  bubble_shape_png?: string | null;
  tab_folders?: unknown;
};

// SpaceRow → Space（camelCase）
function rowToSpace(row: SpaceRow): Space {
  return {
    id: row.id,
    spaceURL: row.space_url ?? undefined,
    name: row.name,
    quickEmotions: row.quick_emotions as EmotionKey[],
    background: row.background as Space['background'],
    savedBackgroundImages: row.saved_background_images ?? undefined,
    createdAt: new Date(row.created_at),
    isPrivate: row.is_private ?? undefined,
    presetTags: row.preset_tags ?? undefined,
    welcomeMessage: row.welcome_message ?? undefined,
    description: row.description ?? undefined,
    characterName: row.character_name ?? undefined,
    ...((): Pick<Space, 'decorations' | 'customEmotions'> => {
      const decorations = parseDecorationsFromJson(row.decorations);
      const customEmotions = parseCustomEmotionsFromJson(row.custom_emotions);
      return {
        ...(decorations.length > 0 ? { decorations } : {}),
        ...(customEmotions.length > 0 ? { customEmotions } : {}),
      };
    })(),
    characterImageUrl: row.character_image_url ?? undefined,
    bubbleShapePng: row.bubble_shape_png ?? undefined,
    tabFolders: (() => {
      if (!('tab_folders' in row)) return undefined;
      return parseTabFolders(row.tab_folders);
    })(),
  };
}

// Space（camelCase）→ INSERT/UPDATE 用オブジェクト（snake_case）
function spaceToRow(space: Space): Omit<SpaceRow, 'created_at'> & { created_at?: string } {
  return {
    id: space.id,
    space_url: space.spaceURL ?? null,
    name: space.name,
    quick_emotions: space.quickEmotions,
    background: space.background ?? { kind: 'pattern', value: 'mist' },
    saved_background_images: space.savedBackgroundImages ?? null,
    created_at: space.createdAt.toISOString(),
    preset_tags: space.presetTags ?? null,
    welcome_message: space.welcomeMessage ?? null,
    description: space.description ?? null,
    character_name: space.characterName ?? null,
    decorations: space.decorations ?? [],
    character_image_url: space.characterImageUrl ?? null,
    custom_emotions: space.customEmotions ?? [],
    bubble_shape_png: space.bubbleShapePng ?? null,
    tab_folders: space.tabFolders?.length ? space.tabFolders : null,
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
  if (patch.quickEmotions !== undefined) updateObj.quick_emotions = patch.quickEmotions;
  if (patch.background !== undefined) updateObj.background = patch.background;
  if (patch.savedBackgroundImages !== undefined) updateObj.saved_background_images = patch.savedBackgroundImages ?? null;
  if (patch.isPrivate !== undefined) updateObj.is_private = patch.isPrivate ?? null;
  if (patch.presetTags !== undefined) updateObj.preset_tags = patch.presetTags ?? null;
  if (patch.welcomeMessage !== undefined) updateObj.welcome_message = patch.welcomeMessage ?? null;
  if (patch.description !== undefined) updateObj.description = patch.description ?? null;
  if (patch.characterName !== undefined) updateObj.character_name = patch.characterName ?? null;
  if (patch.decorations !== undefined) updateObj.decorations = patch.decorations;
  if (patch.characterImageUrl !== undefined) updateObj.character_image_url = patch.characterImageUrl ?? null;
  if (patch.customEmotions !== undefined) updateObj.custom_emotions = patch.customEmotions;
  if (patch.bubbleShapePng !== undefined) updateObj.bubble_shape_png = patch.bubbleShapePng ?? null;
  if (patch.tabFolders !== undefined) {
    updateObj.tab_folders = patch.tabFolders?.length ? patch.tabFolders : null;
  }

  if (Object.keys(updateObj).length === 0) return;

  const { data, error } = await supabase
    .from('spaces')
    .update(updateObj)
    .eq('id', id)
    .select();

  if (error) {
    console.error('[spacesApi] updateSpaceInDb error:', error.message, error);
    throw new Error(error.message);
  }
  if (!data || data.length === 0) {
    console.warn('[spacesApi] updateSpaceInDb: 0 rows updated (RLS ブロックまたは ID 不一致の可能性)', { id, patch });
  }
}

export async function deleteSpaceFromDb(id: SpaceId): Promise<boolean> {
  if (!isSupabaseConfigured) return true;

  const { error } = await supabase.from('spaces').delete().eq('id', id);
  if (error) {
    console.error('[spacesApi] deleteSpaceFromDb error:', error.message, error);
    return false;
  }
  return true;
}

export type CommunityStats = {
  spaceCount: number;
  lastActivityAt: Date | null;
  totalPostCount: number;
};

export async function fetchCommunityStats(communityId: string): Promise<CommunityStats> {
  const empty: CommunityStats = { spaceCount: 0, lastActivityAt: null, totalPostCount: 0 };
  if (!isSupabaseConfigured) return empty;

  const { data: spaceRows, error: spaceError } = await supabase
    .from('spaces')
    .select('id, created_at')
    .eq('community_id', communityId);

  if (spaceError) {
    console.error('[spacesApi] fetchCommunityStats spaces error:', spaceError.message);
    return empty;
  }

  const rows = (spaceRows ?? []) as { id: string; created_at: string }[];
  const spaceCount = rows.length;

  let lastActivityAt: Date | null = null;
  if (rows.length > 0) {
    const latest = rows.reduce((a, b) => (a.created_at > b.created_at ? a : b));
    lastActivityAt = new Date(latest.created_at);
  }

  let totalPostCount = 0;
  if (rows.length > 0) {
    const spaceIds = rows.map((r) => r.id);
    const { count, error: hossiiError } = await supabase
      .from('hossiis')
      .select('id', { count: 'exact', head: true })
      .in('space_id', spaceIds);

    if (hossiiError) {
      console.error('[spacesApi] fetchCommunityStats hossiis error:', hossiiError.message);
    } else {
      totalPostCount = count ?? 0;
    }
  }

  return { spaceCount, lastActivityAt, totalPostCount };
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

  if (!data) return null;

  const space = rowToSpace(data as SpaceRow);
  void ensureDefaultSpacePane(space.id);
  return space;
}
