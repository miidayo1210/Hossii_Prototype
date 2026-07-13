import { supabase, isSupabaseConfigured } from '../supabase';

// RPC fetch_space_post_author_display_names の 1 行。
// クライアントへ返るのは投稿 ID と現在ニックネームのみ（auth_user_id 等は返らない）。
type PostAuthorNameRow = {
  hossii_id: string;
  current_space_nickname: string | null;
};

/**
 * 指定スペースの「投稿 ID → 現在のスペースニックネーム」対応を取得する。
 *
 * - anon（ゲスト）も呼べる（現行の hossiis 閲覧仕様と整合。PII は返らない）。
 * - RPC 内で hossiis → hossii_authorships → space_memberships を結合し、当該スペースかつ
 *   nickname が設定済みの行だけを返す。ゲスト投稿・membership 無し・nickname null は含まれない。
 * - 取得できない投稿は Map に入らない → 呼び出し側は投稿時名（author_name）へ fallback する。
 *
 * @returns hossii_id → current_space_nickname の Map。未設定時は空 Map。
 * @throws RPC 失敗時（呼び出し側で握りつぶし、投稿時名へ fallback すること）。
 */
export async function fetchSpacePostAuthorDisplayNames(
  spaceId: string,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!isSupabaseConfigured || !spaceId) {
    return result;
  }

  const { data, error } = await supabase.rpc(
    'fetch_space_post_author_display_names',
    { p_space_id: spaceId },
  );

  if (error) {
    throw new Error(
      `[spacePostAuthorNamesApi] fetch failed: ${error.message}`,
    );
  }

  for (const row of (data ?? []) as PostAuthorNameRow[]) {
    const name = row.current_space_nickname?.trim();
    if (name) {
      result.set(row.hossii_id, name);
    }
  }
  return result;
}
