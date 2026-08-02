import { supabase, isSupabaseConfigured } from '../supabase';
import type {
  ChallengeResponse,
  ChallengeResponseVisibility,
} from '../types/challengeResponse';
import type { ChallengeItem, ChallengeProgram } from '../types/challengeProgram';
import {
  rowToChallengeItem,
  rowToChallengeProgram,
  type ChallengeItemRow,
  type ChallengeProgramRow,
  type ChallengeOkResult,
} from './challengeProgramsApi';

export type ChallengeResponseRow = {
  id: string;
  item_id: string;
  user_id: string;
  visibility: string;
  comment: string;
  created_at: string;
  updated_at: string;
};

export function rowToChallengeResponse(row: ChallengeResponseRow): ChallengeResponse {
  return {
    id: row.id,
    itemId: row.item_id,
    userId: row.user_id,
    visibility: row.visibility as ChallengeResponseVisibility,
    comment: row.comment,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function formatChallengeError(error: { message: string; code?: string }, fallback: string): string {
  if (error.code === '42501') return '権限がありません';
  if (error.code === '23505') return 'この項目には既に回答があります';
  return error.message || fallback;
}

function mutationFailure(
  error: { message: string; code?: string },
  fallback: string,
): { ok: false; error: string; code?: string } {
  return {
    ok: false,
    error: formatChallengeError(error, fallback),
    ...(error.code ? { code: error.code } : {}),
  };
}

export async function listPublishedChallengePrograms(
  spaceId: string,
): Promise<ChallengeProgram[]> {
  if (!spaceId.trim()) return [];
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('challenge_programs')
    .select('*')
    .eq('space_id', spaceId.trim())
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[challengeResponsesApi] listPublishedChallengePrograms:', error.message);
    throw new Error(error.message);
  }

  return (data as ChallengeProgramRow[]).map(rowToChallengeProgram);
}

export async function listPublishedChallengeItems(
  programId: string,
): Promise<ChallengeItem[]> {
  if (!programId.trim()) return [];
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('challenge_items')
    .select('*')
    .eq('program_id', programId.trim())
    .eq('response_type', 'comment')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[challengeResponsesApi] listPublishedChallengeItems:', error.message);
    throw new Error(error.message);
  }

  return (data as ChallengeItemRow[]).map(rowToChallengeItem);
}

export async function listMyChallengeResponses(
  itemIds: string[],
): Promise<ChallengeResponse[]> {
  const ids = itemIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return [];
  if (!isSupabaseConfigured) return [];

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from('challenge_responses')
    .select('*')
    .in('item_id', ids)
    .eq('user_id', uid);

  if (error) {
    console.error('[challengeResponsesApi] listMyChallengeResponses:', error.message);
    throw new Error(error.message);
  }

  return (data as ChallengeResponseRow[]).map(rowToChallengeResponse);
}

export async function getMyChallengeResponse(
  itemId: string,
): Promise<ChallengeResponse | null> {
  if (!itemId.trim()) return null;
  const list = await listMyChallengeResponses([itemId.trim()]);
  return list[0] ?? null;
}

/**
 * Owner DELETE only. INSERT/UPDATE are RPC-only
 * (`submit_challenge_comment_response`) so answers cannot exist without
 * completion/reward. DELETE keeps completion/reward (response_id SET NULL).
 */
export async function deleteChallengeResponse(
  responseId: string,
): Promise<ChallengeOkResult> {
  if (!responseId.trim()) {
    return { ok: false, error: 'responseId is required' };
  }
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  const { data, error } = await supabase
    .from('challenge_responses')
    .delete()
    .eq('id', responseId.trim())
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[challengeResponsesApi] deleteChallengeResponse:', error.message);
    return mutationFailure(error, '回答の削除に失敗しました');
  }
  if (!data) {
    return { ok: false, error: '回答を削除できませんでした' };
  }

  return { ok: true };
}

/**
 * Manager list for one item. RLS hides self_only from managers.
 * Includes manager_only and space_members rows the caller is allowed to read.
 */
export async function listManagerChallengeResponses(
  itemId: string,
): Promise<ChallengeResponse[]> {
  if (!itemId.trim()) return [];
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('challenge_responses')
    .select('*')
    .eq('item_id', itemId.trim())
    .in('visibility', ['manager_only', 'space_members'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[challengeResponsesApi] listManagerChallengeResponses:', error.message);
    throw new Error(error.message);
  }

  return (data as ChallengeResponseRow[]).map(rowToChallengeResponse);
}

/**
 * Peer-visible answers for challenge items.
 * Client requests visibility=space_members only; RLS is the authority for
 * active-member / space boundaries (self_only and manager_only stay hidden).
 */
export async function listSpaceMemberChallengeResponses(
  itemIds: string[],
): Promise<ChallengeResponse[]> {
  const ids = itemIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return [];
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('challenge_responses')
    .select('*')
    .in('item_id', ids)
    .eq('visibility', 'space_members')
    .order('created_at', { ascending: true });

  if (error) {
    console.error(
      '[challengeResponsesApi] listSpaceMemberChallengeResponses:',
      error.message,
    );
    throw new Error(error.message);
  }

  return (data as ChallengeResponseRow[]).map(rowToChallengeResponse);
}
