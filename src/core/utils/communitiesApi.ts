import { supabase, isSupabaseConfigured } from '../supabase';

const SLUG_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function generateCommunitySlug(): string {
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)];
  }
  return result;
}

export type CommunityStatus = 'pending' | 'approved' | 'rejected';

type CommunityRow = {
  id: string;
  admin_id: string;
  name: string;
  slug: string | null;
  status: CommunityStatus;
  created_at: string;
};

export type Community = {
  id: string;
  adminId: string;
  name: string;
  slug: string | null;
  status: CommunityStatus;
  createdAt: Date;
};

function rowToCommunity(row: CommunityRow): Community {
  return {
    id: row.id,
    adminId: row.admin_id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: new Date(row.created_at),
  };
}

/**
 * 指定ユーザーが管理者として登録しているコミュニティを取得する
 * 存在しなければ null を返す（isAdmin 判定・status 確認に使用）
 */
export async function getAdminCommunity(adminId: string): Promise<Community | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('communities')
    .select('*')
    .eq('admin_id', adminId)
    .maybeSingle();

  if (error) {
    console.error('[communitiesApi] getAdminCommunity error:', error.message);
    return null;
  }

  return data ? rowToCommunity(data as CommunityRow) : null;
}

/**
 * 全コミュニティを取得する（スーパー管理者専用）
 * Supabase RLS により super_admin ロール以外は空配列が返る
 */
export async function fetchAllCommunities(): Promise<Community[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('communities')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[communitiesApi] fetchAllCommunities error:', error.message);
    return [];
  }

  return (data as CommunityRow[]).map(rowToCommunity);
}

/**
 * slug でコミュニティを1件取得する（スーパー管理者専用）
 * URL パラメータからコミュニティ情報を復元する用途で使用
 */
export async function fetchCommunityBySlug(slug: string): Promise<Community | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('communities')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('[communitiesApi] fetchCommunityBySlug error:', error.message);
    return null;
  }

  return data ? rowToCommunity(data as CommunityRow) : null;
}

/**
 * コミュニティの slug を更新する（管理者本人のみ可 / RLS で保護）
 * 成功時は true、失敗時は false を返す
 */
export async function updateCommunitySlug(communityId: string, slug: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { error } = await supabase
    .from('communities')
    .update({ slug })
    .eq('id', communityId);

  if (error) {
    console.error('[communitiesApi] updateCommunitySlug error:', error.message);
    return false;
  }

  return true;
}

/**
 * コミュニティを新規作成する（adminSignUp 時に呼ぶ）
 * status はデフォルト 'pending'（審査待ち）
 */
export async function createCommunity(adminId: string, name: string): Promise<Community | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('communities')
    .insert({ admin_id: adminId, name, slug: generateCommunitySlug() })
    .select()
    .single();

  if (error) {
    console.error('[communitiesApi] createCommunity error:', error.message);
    return null;
  }

  return rowToCommunity(data as CommunityRow);
}
