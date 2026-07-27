import { isSupabaseConfigured } from '../supabase';
import { upsertSpaceNickname } from './profilesApi';
import { updateMySpaceNickname } from './spaceMembershipsApi';

/**
 * スペース内ニックネームを正本 `space_nicknames` に保存し、
 * 可能なら `space_memberships.space_nickname` も同期する（投稿者現在名 RPC 用）。
 * membership 未作成時の update 失敗は握りつぶす（space_nicknames 成功を正とする）。
 */
export async function persistSpaceNickname(params: {
  profileId: string;
  spaceId: string;
  nickname: string;
}): Promise<void> {
  const trimmed = params.nickname.trim();
  if (!trimmed) {
    throw new Error('nickname is empty');
  }
  if (!isSupabaseConfigured) return;

  await upsertSpaceNickname(params.profileId, params.spaceId, trimmed);

  const membershipResult = await updateMySpaceNickname(params.spaceId, trimmed);
  if (!membershipResult.ok) {
    // membership 未作成時などは握りつぶす（space_nicknames 成功を正とする）
    console.warn(
      '[persistSpaceNickname] update_my_space_nickname skipped',
      membershipResult.message,
    );
  }
}
