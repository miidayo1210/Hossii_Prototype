import { supabase, isSupabaseConfigured } from '../supabase';

type HossiiAuthorshipRow = {
  hossii_id: string;
};

/**
 * 現在スペースに属する本人 authorship の hossii ID を取得する。
 * 本人判定は RLS（auth.uid()）に任せ、Auth UID を引数に取らない。
 */
export async function fetchMyAuthorshipIdsForSpace(
  spaceId: string,
): Promise<Set<string> | null> {
  if (!isSupabaseConfigured || !spaceId) {
    return new Set();
  }

  const { data, error } = await supabase
    .from('hossii_authorships')
    .select('hossii_id, hossiis!inner(space_id)')
    .eq('hossiis.space_id', spaceId);

  if (error) {
    console.error('[hossiiAuthorshipsApi] fetchMyAuthorshipIdsForSpace error:', error.message);
    return null;
  }

  const rows = data ?? [];
  return new Set(rows.map((row) => (row as HossiiAuthorshipRow).hossii_id));
}
