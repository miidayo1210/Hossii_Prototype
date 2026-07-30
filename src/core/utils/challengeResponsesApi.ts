import { supabase, isSupabaseConfigured } from '../supabase';
import type {
  ChallengeResponse,
  ChallengeResponseVisibility,
  CreateChallengeResponseInput,
  UpdateChallengeResponseInput,
} from '../types/challengeResponse';
import type { ChallengeItem, ChallengeProgram } from '../types/challengeProgram';
import {
  rowToChallengeItem,
  rowToChallengeProgram,
  type ChallengeItemRow,
  type ChallengeProgramRow,
  type ChallengeMutationResult,
  type ChallengeOkResult,
} from './challengeProgramsApi';
import {
  normalizeCreateChallengeResponseInput,
  normalizeUpdateChallengeResponseInput,
} from './challengeResponseValidation';

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

/** Insert payload — never includes user_id. */
export function buildCreateChallengeResponsePayload(input: {
  itemId: string;
  comment: string;
  visibility: ChallengeResponseVisibility;
}): { item_id: string; comment: string; visibility: string } {
  return {
    item_id: input.itemId,
    comment: input.comment,
    visibility: input.visibility,
  };
}

/** Update payload — never includes item_id or user_id. */
export function buildUpdateChallengeResponsePayload(input: {
  comment?: string;
  visibility?: ChallengeResponseVisibility;
}): Record<string, string> {
  const payload: Record<string, string> = {};
  if (input.comment !== undefined) payload.comment = input.comment;
  if (input.visibility !== undefined) payload.visibility = input.visibility;
  return payload;
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
 * Low-level create (no completion/reward).
 * Participant answer UI must use submitChallengeCommentResponse instead.
 */
export async function createChallengeResponse(
  input: CreateChallengeResponseInput,
): Promise<ChallengeMutationResult<ChallengeResponse>> {
  const normalized = normalizeCreateChallengeResponseInput(input);
  if (!normalized.ok) {
    return { ok: false, error: normalized.message };
  }
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  const payload = buildCreateChallengeResponsePayload(normalized.value);
  const { data, error } = await supabase
    .from('challenge_responses')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[challengeResponsesApi] createChallengeResponse:', error.message);
    return mutationFailure(error, '回答の保存に失敗しました');
  }
  if (!data) {
    return { ok: false, error: '回答の保存に失敗しました' };
  }

  return { ok: true, value: rowToChallengeResponse(data as ChallengeResponseRow) };
}

/**
 * Low-level update (no reward re-roll).
 * Prefer submitChallengeCommentResponse from participant UI so completion links stay fresh.
 */
export async function updateChallengeResponse(
  responseId: string,
  input: UpdateChallengeResponseInput,
): Promise<ChallengeMutationResult<ChallengeResponse>> {
  if (!responseId.trim()) {
    return { ok: false, error: 'responseId is required' };
  }

  const normalized = normalizeUpdateChallengeResponseInput(input);
  if (!normalized.ok) {
    return { ok: false, error: normalized.message };
  }
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  const payload = buildUpdateChallengeResponsePayload(normalized.value);
  const { data, error } = await supabase
    .from('challenge_responses')
    .update(payload)
    .eq('id', responseId.trim())
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[challengeResponsesApi] updateChallengeResponse:', error.message);
    return mutationFailure(error, '回答の更新に失敗しました');
  }
  if (!data) {
    return { ok: false, error: '回答の更新に失敗しました' };
  }

  return { ok: true, value: rowToChallengeResponse(data as ChallengeResponseRow) };
}

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
 * Manager list for one item. RLS returns only manager_only rows (+ own).
 * Callers must not infer self_only existence from empty results.
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
    .eq('visibility', 'manager_only')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[challengeResponsesApi] listManagerChallengeResponses:', error.message);
    throw new Error(error.message);
  }

  return (data as ChallengeResponseRow[]).map(rowToChallengeResponse);
}
