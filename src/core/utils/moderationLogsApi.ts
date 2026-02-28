import { supabase, isSupabaseConfigured } from '../supabase';

type ModerationAction = 'hide' | 'restore';

type InsertModerationLogParams = {
  spaceId: string;
  hossiiId: string;
  action: ModerationAction;
  adminId: string;
};

export async function insertModerationLog({
  spaceId,
  hossiiId,
  action,
  adminId,
}: InsertModerationLogParams): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from('moderation_logs').insert({
    space_id: spaceId,
    hossii_id: hossiiId,
    action,
    admin_id: adminId,
  });

  if (error) {
    console.error('[moderationLogsApi] insertModerationLog error:', error.message);
  }
}
