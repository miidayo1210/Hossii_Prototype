import { supabase, isSupabaseConfigured } from '../supabase';

/** DB の can_access_space(space_id) をクライアントから確認する（RLS と整合）。 */
export async function checkCanAccessSpace(spaceId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !spaceId) return false;

  const { data, error } = await supabase.rpc('can_access_space', { p_space_id: spaceId });
  if (error) {
    console.error('[spaceAccessApi] can_access_space failed:', error.message);
    return false;
  }
  return data === true;
}
