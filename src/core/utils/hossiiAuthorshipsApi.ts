import { supabase, isSupabaseConfigured } from '../supabase';

type HossiiAuthorshipRow = {
  hossii_id: string;
};

/**
 * 現在ログイン中の本人について、指定 space 内に存在する authorship 付き投稿の
 * hossii_id 一覧を取得する。
 *
 * 本人性の正本は public.hossii_authorships.auth_user_id。
 * - 本人限定は RLS (auth_user_id = auth.uid()) に委ねる。auth_user_id は引数に取らない。
 * - hossiis.author_id は本人判定に使用しない（author_id フォールバックなし）。
 * - 通常の anon key クライアント (`supabase`) のみを使用し、service role は使わない。
 * - 未ログイン時は空配列で暗黙成功させる。anon ロールは hossii_authorships に
 *   テーブル権限が無く、クエリ自体が permission denied となるため、セッションが
 *   無い場合はクエリを実行せず空を返す（現行 imageStorageApi と同じ getSession 判定）。
 *
 * hossii_id は hossii_authorships の PRIMARY KEY のため本質的に一意だが、
 * 重複除外を明示するため Set を経由して返す。
 *
 * @param spaceId 対象スペースの ID
 * @returns 本人の authorship 付き hossii_id 配列（重複なし）
 * @throws ログイン中に Supabase クエリが失敗した場合（呼び出し側が失敗を判別できるよう握りつぶさない）
 */
export async function fetchMyAuthorshipIdsForSpace(spaceId: string): Promise<string[]> {
  if (!isSupabaseConfigured || !spaceId) {
    return [];
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return [];
  }

  const { data, error } = await supabase
    .from('hossii_authorships')
    .select('hossii_id, hossiis!inner(space_id)')
    .eq('hossiis.space_id', spaceId);

  if (error) {
    throw new Error(`[hossiiAuthorshipsApi] fetchMyAuthorshipIdsForSpace failed: ${error.message}`);
  }

  const rows = (data ?? []) as HossiiAuthorshipRow[];
  return [...new Set(rows.map((row) => row.hossii_id))];
}
