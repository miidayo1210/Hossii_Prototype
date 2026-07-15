import { supabase, isSupabaseConfigured } from '../supabase';
import type { HossiiVisibility } from '../types';

/**
 * Phase 2D-1: ログイン本人による投稿の 本文編集 / 公開範囲変更 / ソフト削除 API。
 *
 * すべて SECURITY DEFINER RPC を経由し、本人確認は DB 側の auth.uid() +
 * hossii_authorships で行う。クライアントから auth_user_id / role は一切渡さない。
 * session なし・Supabase 未設定時は安全に失敗する（例外を投げず ok:false を返す）。
 *
 * これらは Phase 2D-1 の基盤であり、この段階では既存 UI から呼び出さない
 * （投稿メニュー・編集モーダル・削除確認などの UI は Phase 2D-2）。
 */

export type MyHossiiMutationResult =
  | { ok: true }
  | { ok: false; message: string; code?: string };

export type UpdateMyHossiiResult =
  | { ok: true; contentEditedAt: Date | null }
  | { ok: false; message: string; code?: string };

const NOT_CONFIGURED = 'Supabase is not configured';

/** 本人投稿の本文（message）を編集する。成功時に content_edited_at が更新される。 */
export async function updateMyHossii(
  hossiiId: string,
  message: string,
): Promise<UpdateMyHossiiResult> {
  if (!isSupabaseConfigured) return { ok: false, message: NOT_CONFIGURED };

  const { data, error } = await supabase.rpc('update_my_hossii', {
    p_hossii_id: hossiiId,
    p_message: message,
  });
  if (error) {
    return { ok: false, message: error.message, code: error.code };
  }
  return {
    ok: true,
    contentEditedAt: data ? new Date(data as string) : null,
  };
}

/** 本人投稿の公開範囲を変更する（public <-> owner_only）。 */
export async function setMyHossiiVisibility(
  hossiiId: string,
  visibility: HossiiVisibility,
): Promise<MyHossiiMutationResult> {
  if (!isSupabaseConfigured) return { ok: false, message: NOT_CONFIGURED };

  const { error } = await supabase.rpc('set_my_hossii_visibility', {
    p_hossii_id: hossiiId,
    p_visibility: visibility,
  });
  if (error) {
    return { ok: false, message: error.message, code: error.code };
  }
  return { ok: true };
}

/** 本人投稿をソフト削除する（物理 DELETE はしない）。 */
export async function softDeleteMyHossii(
  hossiiId: string,
): Promise<MyHossiiMutationResult> {
  if (!isSupabaseConfigured) return { ok: false, message: NOT_CONFIGURED };

  const { error } = await supabase.rpc('soft_delete_my_hossii', {
    p_hossii_id: hossiiId,
  });
  if (error) {
    return { ok: false, message: error.message, code: error.code };
  }
  return { ok: true };
}
