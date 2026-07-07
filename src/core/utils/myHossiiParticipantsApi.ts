import { supabase, isSupabaseConfigured } from '../supabase';
import type { MyHossiiParticipant } from '../types/myHossii';

type RpcRow = {
  user_id: string;
  nickname: string;
  hossii_source_type: string;
  hossii_preset_key: string | null;
  hossii_image_path: string | null;
  hossii_updated_at: string | null;
};

function rowToParticipant(row: RpcRow): MyHossiiParticipant | null {
  if (row.hossii_source_type !== 'preset' && row.hossii_source_type !== 'upload') {
    return null;
  }
  return {
    userId: row.user_id,
    nickname: row.nickname,
    hossiiSourceType: row.hossii_source_type,
    hossiiPresetKey: row.hossii_preset_key,
    hossiiImagePath: row.hossii_image_path,
    hossiiUpdatedAt: row.hossii_updated_at,
  };
}

export async function fetchMyHossiiParticipants(
  spaceId: string,
): Promise<MyHossiiParticipant[]> {
  if (!isSupabaseConfigured || !spaceId) return [];

  const { data, error } = await supabase.rpc('list_my_hossii_participants', {
    p_space_id: spaceId,
  });

  if (error) {
    console.error('[myHossiiParticipantsApi] fetch error:', error.message);
    throw error;
  }

  if (!Array.isArray(data)) return [];

  const seen = new Set<string>();
  const result: MyHossiiParticipant[] = [];

  for (const row of data as RpcRow[]) {
    if (seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    const participant = rowToParticipant(row);
    if (participant) result.push(participant);
  }

  return result;
}

/** @internal テスト用 */
export function parseRpcRowForTest(row: RpcRow): MyHossiiParticipant | null {
  return rowToParticipant(row);
}
