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
