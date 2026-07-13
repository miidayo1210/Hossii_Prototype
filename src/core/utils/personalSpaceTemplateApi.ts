import { supabase, isSupabaseConfigured } from '../supabase';

/**
 * Phase 4: コミュニティの個人スペーステンプレート（communities.personal_space_template）。
 *
 * テンプレートは community に属し、個人スペースの「作成時にコピー」する初期構成を定義する。
 * 編集・参照はコミュニティ管理者・super_admin のみ（communities の既存 RLS で強制）。
 * 既存の個人スペースへは自動反映しない（適用は ensure_my_personal_space の作成時のみ）。
 */
export type PersonalSpaceTemplatePane = {
  name: string;
  slug: string;
  sort_order?: number;
  is_visible?: boolean;
  background?: unknown;
  decorations?: unknown;
  character_image_url?: string;
  character_name?: string;
  custom_emotions?: unknown;
  bubble_shape_png?: string;
  saved_background_images?: unknown;
  settings?: unknown;
};

export type PersonalSpaceTemplate = {
  enabled?: boolean;
  name_pattern?: string;
  background?: { kind: string; value: string; source?: string };
  space_settings?: {
    post_fields?: Record<string, { enabled?: boolean; required?: boolean }>;
  };
  panes?: PersonalSpaceTemplatePane[];
};

/**
 * コミュニティのテンプレートを取得する（管理者・super_admin のみ RLS で許可）。
 * 未設定時は null。取得失敗（権限含む）時は throw。
 */
export async function fetchCommunityPersonalSpaceTemplate(
  communityId: string,
): Promise<PersonalSpaceTemplate | null> {
  if (!isSupabaseConfigured || !communityId) return null;

  const { data, error } = await supabase
    .from('communities')
    .select('personal_space_template')
    .eq('id', communityId)
    .maybeSingle();

  if (error) {
    throw new Error(`[personalSpaceTemplateApi] fetch failed: ${error.message}`);
  }
  return (data?.personal_space_template as PersonalSpaceTemplate | null) ?? null;
}

export type SaveTemplateResult =
  | { ok: true }
  | { ok: false; message: string; code?: string };

/**
 * コミュニティのテンプレートを保存する。
 * - communities の UPDATE は既存 RLS でコミュニティ管理者・super_admin のみ許可される。
 *   一般メンバー・ゲスト・他コミュニティ管理者は 0 行更新（= ok:false）。
 * - .select() で更新行数を確認し、RLS ブロックを ok:false として返す。
 */
export async function saveCommunityPersonalSpaceTemplate(
  communityId: string,
  template: PersonalSpaceTemplate,
): Promise<SaveTemplateResult> {
  if (!isSupabaseConfigured || !communityId) {
    return { ok: false, message: 'Supabase is not configured' };
  }

  const { data, error } = await supabase
    .from('communities')
    .update({ personal_space_template: template })
    .eq('id', communityId)
    .select('id');

  if (error) {
    return { ok: false, message: error.message, code: error.code };
  }
  if (!data || data.length === 0) {
    return { ok: false, message: 'not authorized or community not found' };
  }
  return { ok: true };
}
