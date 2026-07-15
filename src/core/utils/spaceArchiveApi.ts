import { supabase, isSupabaseConfigured } from '../supabase';
import type { Space } from '../types/space';

export type SetSpaceArchivedResult =
  | {
      ok: true;
      spaceId: string;
      isArchived: boolean;
      archivedAt: string | null;
      archivedBy: string | null;
    }
  | { ok: false; message: string; code?: string };

type ArchiveRow = {
  space_id: string;
  is_archived: boolean;
  archived_at: string | null;
  archived_by: string | null;
};

export function mapArchiveRpcRow(row: ArchiveRow) {
  return {
    spaceId: row.space_id,
    isArchived: row.is_archived,
    archivedAt: row.archived_at,
    archivedBy: row.archived_by,
  };
}

/**
 * スペースのアーカイブ ON/OFF（112 DB 層）。
 * 権限は RPC 内の can_manage_space_archive が判定する。
 */
export async function setSpaceArchived(
  spaceId: string,
  archived: boolean,
): Promise<SetSpaceArchivedResult> {
  if (!isSupabaseConfigured || !spaceId) {
    return { ok: false, message: 'Supabase is not configured' };
  }

  const { data, error } = await supabase.rpc('set_space_archived', {
    p_space_id: spaceId,
    p_archived: archived,
  });

  if (error) {
    return { ok: false, message: error.message, code: error.code };
  }

  const row = (Array.isArray(data) ? data[0] : data) as ArchiveRow | undefined;
  if (!row?.space_id) {
    return { ok: false, message: 'archive state not returned' };
  }

  const mapped = mapArchiveRpcRow(row);
  return { ok: true, ...mapped };
}

type ArchiveFlagRow = {
  id: string;
  is_archived: boolean | null;
};

/**
 * 複数スペースのアーカイブ状態を一括取得する（一覧バッジ用）。
 * RPC 変更なし。既存 `spaces.is_archived` 列のみ参照する。
 */
export async function fetchSpaceArchiveFlags(spaceIds: string[]): Promise<Map<string, boolean>> {
  const flags = new Map<string, boolean>();
  if (!isSupabaseConfigured || spaceIds.length === 0) return flags;

  const { data, error } = await supabase
    .from('spaces')
    .select('id, is_archived')
    .in('id', spaceIds);

  if (error) {
    console.error('[spaceArchiveApi] fetch archive flags failed');
    return flags;
  }

  for (const row of (data ?? []) as ArchiveFlagRow[]) {
    flags.set(row.id, row.is_archived === true);
  }
  return flags;
}

/** Space 型へ archive フィールドをマージする（MERGE_SPACE 用）。 */
export function applyArchiveFieldsToSpace(
  space: Space,
  patch: Pick<Space, 'isArchived' | 'archivedAt' | 'archivedBy'>,
): Space {
  return {
    ...space,
    isArchived: patch.isArchived ?? false,
    archivedAt: patch.archivedAt,
    archivedBy: patch.archivedBy,
  };
}
