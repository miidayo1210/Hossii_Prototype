import { supabase, isSupabaseConfigured } from '../supabase';

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
 * コミュニティを新規作成する（adminSignUp 時に呼ぶ）
 * status はデフォルト 'pending'（審査待ち）
 */
export async function createCommunity(adminId: string, name: string): Promise<Community | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('communities')
    .insert({ admin_id: adminId, name })
    .select()
    .single();

  if (error) {
    console.error('[communitiesApi] createCommunity error:', error.message);
    return null;
  }

  return rowToCommunity(data as CommunityRow);
}
