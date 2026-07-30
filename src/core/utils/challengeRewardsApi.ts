import { supabase, isSupabaseConfigured } from '../supabase';
import type { ChallengeResponseVisibility } from '../types/challengeResponse';
import type {
  ChallengeCompletion,
  ChallengeReward,
  SubmitChallengeCommentResult,
} from '../types/challengeReward';
import { normalizeCreateChallengeResponseInput } from './challengeResponseValidation';
import type { ChallengeMutationResult } from './challengeProgramsApi';

export type ChallengeCompletionRow = {
  id: string;
  item_id: string;
  user_id: string;
  response_id: string | null;
  completed_at: string;
  created_at: string;
};

export type ChallengeRewardRow = {
  id: string;
  completion_id: string;
  user_id: string;
  item_id: string;
  hossii_key: string;
  awarded_at: string;
  created_at: string;
};

type SubmitRpcPayload = {
  response: {
    id: string;
    item_id: string;
    user_id: string;
    visibility: string;
    comment: string;
    created_at: string;
    updated_at: string;
  };
  completion: ChallengeCompletionRow;
  reward: ChallengeRewardRow;
  is_new_reward: boolean;
  was_insert: boolean;
};

export function rowToChallengeCompletion(row: ChallengeCompletionRow): ChallengeCompletion {
  return {
    id: row.id,
    itemId: row.item_id,
    userId: row.user_id,
    responseId: row.response_id,
    completedAt: new Date(row.completed_at),
    createdAt: new Date(row.created_at),
  };
}

export function rowToChallengeReward(row: ChallengeRewardRow): ChallengeReward {
  return {
    id: row.id,
    completionId: row.completion_id,
    userId: row.user_id,
    itemId: row.item_id,
    hossiiKey: row.hossii_key,
    awardedAt: new Date(row.awarded_at),
    createdAt: new Date(row.created_at),
  };
}

function mapSubmitPayload(payload: SubmitRpcPayload): SubmitChallengeCommentResult {
  return {
    response: {
      id: payload.response.id,
      itemId: payload.response.item_id,
      userId: payload.response.user_id,
      visibility: payload.response.visibility as ChallengeResponseVisibility,
      comment: payload.response.comment,
      createdAt: new Date(payload.response.created_at),
      updatedAt: new Date(payload.response.updated_at),
    },
    completion: rowToChallengeCompletion(payload.completion),
    reward: rowToChallengeReward(payload.reward),
    isNewReward: Boolean(payload.is_new_reward),
    wasInsert: Boolean(payload.was_insert),
  };
}

/**
 * Participant answer save path (P5+).
 * Atomically upserts response, ensures completion, awards at most one Hossii.
 * Prefer this over createChallengeResponse / updateChallengeResponse in ChallengeScreen.
 */
export async function submitChallengeCommentResponse(input: {
  itemId: string;
  comment: string;
  visibility?: ChallengeResponseVisibility;
}): Promise<ChallengeMutationResult<SubmitChallengeCommentResult>> {
  const normalized = normalizeCreateChallengeResponseInput({
    itemId: input.itemId,
    comment: input.comment,
    visibility: input.visibility,
  });
  if (!normalized.ok) {
    return { ok: false, error: normalized.message };
  }
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  const { data, error } = await supabase.rpc('submit_challenge_comment_response', {
    p_item_id: normalized.value.itemId,
    p_comment: normalized.value.comment,
    p_visibility: normalized.value.visibility,
  });

  if (error) {
    console.error('[challengeRewardsApi] submitChallengeCommentResponse:', error.message);
    if (error.code === '42501') {
      return { ok: false, error: '権限がありません', code: error.code };
    }
    return { ok: false, error: error.message || '回答の保存に失敗しました', code: error.code };
  }
  if (!data) {
    return { ok: false, error: '回答の保存に失敗しました' };
  }

  return { ok: true, value: mapSubmitPayload(data as SubmitRpcPayload) };
}

export async function listMyChallengeRewards(): Promise<ChallengeReward[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('challenge_rewards')
    .select('*')
    .order('awarded_at', { ascending: false });

  if (error) {
    console.error('[challengeRewardsApi] listMyChallengeRewards:', error.message);
    throw new Error(error.message);
  }

  return (data as ChallengeRewardRow[]).map(rowToChallengeReward);
}

export async function listMyChallengeCompletions(
  itemIds?: string[],
): Promise<ChallengeCompletion[]> {
  if (!isSupabaseConfigured) return [];

  let query = supabase.from('challenge_completions').select('*');
  if (itemIds && itemIds.length > 0) {
    query = query.in('item_id', itemIds.map((id) => id.trim()).filter(Boolean));
  }

  const { data, error } = await query.order('completed_at', { ascending: false });
  if (error) {
    console.error('[challengeRewardsApi] listMyChallengeCompletions:', error.message);
    throw new Error(error.message);
  }

  return (data as ChallengeCompletionRow[]).map(rowToChallengeCompletion);
}

export async function getRewardForItem(itemId: string): Promise<ChallengeReward | null> {
  if (!itemId.trim() || !isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('challenge_rewards')
    .select('*')
    .eq('item_id', itemId.trim())
    .maybeSingle();

  if (error) {
    console.error('[challengeRewardsApi] getRewardForItem:', error.message);
    throw new Error(error.message);
  }

  return data ? rowToChallengeReward(data as ChallengeRewardRow) : null;
}
