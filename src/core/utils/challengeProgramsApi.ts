import { supabase, isSupabaseConfigured } from '../supabase';
import type {
  ChallengeItem,
  ChallengeItemType,
  ChallengeProgram,
  ChallengeProgramStatus,
  ChallengeResponseType,
  CreateChallengeItemInput,
  CreateChallengeProgramInput,
  UpdateChallengeItemInput,
  UpdateChallengeProgramInput,
} from '../types/challengeProgram';
import {
  normalizeChallengeProgramStatus,
  normalizeCreateChallengeItemInput,
  normalizeCreateChallengeProgramInput,
  normalizeUpdateChallengeItemInput,
  normalizeUpdateChallengeProgramInput,
} from './challengeValidation';

export type ChallengeProgramRow = {
  id: string;
  space_id: string;
  title: string;
  description: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ChallengeItemRow = {
  id: string;
  program_id: string;
  item_type: string;
  title: string;
  description: string | null;
  reason: string | null;
  response_type: string;
  is_required: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ChallengeMutationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; code?: string };

export type ChallengeOkResult = { ok: true } | { ok: false; error: string; code?: string };

export function rowToChallengeProgram(row: ChallengeProgramRow): ChallengeProgram {
  return {
    id: row.id,
    spaceId: row.space_id,
    title: row.title,
    description: row.description,
    status: row.status as ChallengeProgramStatus,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function rowToChallengeItem(row: ChallengeItemRow): ChallengeItem {
  return {
    id: row.id,
    programId: row.program_id,
    itemType: row.item_type as ChallengeItemType,
    title: row.title,
    description: row.description,
    reason: row.reason,
    responseType: row.response_type as ChallengeResponseType,
    isRequired: row.is_required,
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/** Insert payload for createChallengeProgram — never includes created_by or status override. */
export function buildCreateChallengeProgramPayload(input: {
  spaceId: string;
  title: string;
  description: string | null;
}): { space_id: string; title: string; description: string | null } {
  return {
    space_id: input.spaceId,
    title: input.title,
    description: input.description,
  };
}

export function buildUpdateChallengeProgramPayload(input: {
  title?: string;
  description?: string | null;
}): Record<string, string | null> {
  const payload: Record<string, string | null> = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.description !== undefined) payload.description = input.description;
  return payload;
}

export function buildCreateChallengeItemPayload(input: {
  programId: string;
  itemType: ChallengeItemType;
  title: string;
  description: string | null;
  reason: string | null;
  responseType: ChallengeResponseType;
  isRequired: boolean;
  sortOrder: number;
}): Record<string, string | number | boolean | null> {
  return {
    program_id: input.programId,
    item_type: input.itemType,
    title: input.title,
    description: input.description,
    reason: input.reason,
    response_type: input.responseType,
    is_required: input.isRequired,
    sort_order: input.sortOrder,
  };
}

export function buildUpdateChallengeItemPayload(input: {
  itemType?: ChallengeItemType;
  title?: string;
  description?: string | null;
  reason?: string | null;
  responseType?: ChallengeResponseType;
  isRequired?: boolean;
  sortOrder?: number;
}): Record<string, string | number | boolean | null> {
  const payload: Record<string, string | number | boolean | null> = {};
  if (input.itemType !== undefined) payload.item_type = input.itemType;
  if (input.title !== undefined) payload.title = input.title;
  if (input.description !== undefined) payload.description = input.description;
  if (input.reason !== undefined) payload.reason = input.reason;
  if (input.responseType !== undefined) payload.response_type = input.responseType;
  if (input.isRequired !== undefined) payload.is_required = input.isRequired;
  if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;
  return payload;
}

function formatChallengeError(error: { message: string; code?: string }, fallback: string): string {
  if (error.code === '42501') {
    return '権限がありません';
  }
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

export async function listChallengePrograms(spaceId: string): Promise<ChallengeProgram[]> {
  if (!spaceId.trim()) return [];
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('challenge_programs')
    .select('*')
    .eq('space_id', spaceId.trim())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[challengeProgramsApi] listChallengePrograms error:', error.message);
    return [];
  }

  return (data as ChallengeProgramRow[]).map(rowToChallengeProgram);
}

export async function getChallengeProgram(programId: string): Promise<ChallengeProgram | null> {
  if (!programId.trim()) return null;
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('challenge_programs')
    .select('*')
    .eq('id', programId.trim())
    .maybeSingle();

  if (error) {
    console.error('[challengeProgramsApi] getChallengeProgram error:', error.message);
    return null;
  }

  return data ? rowToChallengeProgram(data as ChallengeProgramRow) : null;
}

export async function createChallengeProgram(
  input: CreateChallengeProgramInput,
): Promise<ChallengeMutationResult<ChallengeProgram>> {
  const normalized = normalizeCreateChallengeProgramInput(input);
  if (!normalized.ok) {
    return { ok: false, error: normalized.message };
  }

  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  const payload = buildCreateChallengeProgramPayload(normalized.value);
  const { data, error } = await supabase
    .from('challenge_programs')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[challengeProgramsApi] createChallengeProgram error:', error.message);
    return mutationFailure(error, '挑戦状ストーリーの作成に失敗しました');
  }
  if (!data) {
    return { ok: false, error: '挑戦状ストーリーの作成に失敗しました' };
  }

  return { ok: true, value: rowToChallengeProgram(data as ChallengeProgramRow) };
}

export async function updateChallengeProgram(
  programId: string,
  input: UpdateChallengeProgramInput,
): Promise<ChallengeMutationResult<ChallengeProgram>> {
  if (!programId.trim()) {
    return { ok: false, error: 'programId is required' };
  }

  const normalized = normalizeUpdateChallengeProgramInput(input);
  if (!normalized.ok) {
    return { ok: false, error: normalized.message };
  }

  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  const payload = buildUpdateChallengeProgramPayload(normalized.value);
  const { data, error } = await supabase
    .from('challenge_programs')
    .update(payload)
    .eq('id', programId.trim())
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[challengeProgramsApi] updateChallengeProgram error:', error.message);
    return mutationFailure(error, '挑戦状ストーリーの更新に失敗しました');
  }
  if (!data) {
    return { ok: false, error: '挑戦状ストーリーの更新に失敗しました' };
  }

  return { ok: true, value: rowToChallengeProgram(data as ChallengeProgramRow) };
}

export async function updateChallengeProgramStatus(
  programId: string,
  status: ChallengeProgramStatus,
): Promise<ChallengeMutationResult<ChallengeProgram>> {
  if (!programId.trim()) {
    return { ok: false, error: 'programId is required' };
  }

  const normalized = normalizeChallengeProgramStatus(status);
  if (!normalized.ok) {
    return { ok: false, error: normalized.message };
  }

  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  const { data, error } = await supabase
    .from('challenge_programs')
    .update({ status: normalized.value })
    .eq('id', programId.trim())
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[challengeProgramsApi] updateChallengeProgramStatus error:', error.message);
    return mutationFailure(error, '挑戦状ステータスの更新に失敗しました');
  }
  if (!data) {
    return { ok: false, error: '挑戦状ステータスの更新に失敗しました' };
  }

  return { ok: true, value: rowToChallengeProgram(data as ChallengeProgramRow) };
}

export async function deleteChallengeProgram(programId: string): Promise<ChallengeOkResult> {
  if (!programId.trim()) {
    return { ok: false, error: 'programId is required' };
  }
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  const { data, error } = await supabase
    .from('challenge_programs')
    .delete()
    .eq('id', programId.trim())
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[challengeProgramsApi] deleteChallengeProgram error:', error.message);
    return mutationFailure(error, '挑戦状ストーリーの削除に失敗しました');
  }
  if (!data) {
    return {
      ok: false,
      error: '削除できませんでした（draft以外、権限不足、または対象なし）',
    };
  }

  return { ok: true };
}

export async function listChallengeItems(programId: string): Promise<ChallengeItem[]> {
  if (!programId.trim()) return [];
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('challenge_items')
    .select('*')
    .eq('program_id', programId.trim())
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[challengeProgramsApi] listChallengeItems error:', error.message);
    return [];
  }

  return (data as ChallengeItemRow[]).map(rowToChallengeItem);
}

export async function getChallengeItem(itemId: string): Promise<ChallengeItem | null> {
  if (!itemId.trim()) return null;
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('challenge_items')
    .select('*')
    .eq('id', itemId.trim())
    .maybeSingle();

  if (error) {
    console.error('[challengeProgramsApi] getChallengeItem error:', error.message);
    return null;
  }

  return data ? rowToChallengeItem(data as ChallengeItemRow) : null;
}

export async function createChallengeItem(
  input: CreateChallengeItemInput,
): Promise<ChallengeMutationResult<ChallengeItem>> {
  const normalized = normalizeCreateChallengeItemInput(input);
  if (!normalized.ok) {
    return { ok: false, error: normalized.message };
  }

  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  const payload = buildCreateChallengeItemPayload(normalized.value);
  const { data, error } = await supabase
    .from('challenge_items')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[challengeProgramsApi] createChallengeItem error:', error.message);
    return mutationFailure(error, '挑戦状項目の作成に失敗しました');
  }
  if (!data) {
    return { ok: false, error: '挑戦状項目の作成に失敗しました' };
  }

  return { ok: true, value: rowToChallengeItem(data as ChallengeItemRow) };
}

export async function updateChallengeItem(
  itemId: string,
  input: UpdateChallengeItemInput,
): Promise<ChallengeMutationResult<ChallengeItem>> {
  if (!itemId.trim()) {
    return { ok: false, error: 'itemId is required' };
  }

  const normalized = normalizeUpdateChallengeItemInput(input);
  if (!normalized.ok) {
    return { ok: false, error: normalized.message };
  }

  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  const payload = buildUpdateChallengeItemPayload(normalized.value);
  const { data, error } = await supabase
    .from('challenge_items')
    .update(payload)
    .eq('id', itemId.trim())
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[challengeProgramsApi] updateChallengeItem error:', error.message);
    return mutationFailure(error, '挑戦状項目の更新に失敗しました');
  }
  if (!data) {
    return {
      ok: false,
      error: '更新できませんでした（親がdraft以外、権限不足、または対象なし）',
    };
  }

  return { ok: true, value: rowToChallengeItem(data as ChallengeItemRow) };
}

export async function deleteChallengeItem(itemId: string): Promise<ChallengeOkResult> {
  if (!itemId.trim()) {
    return { ok: false, error: 'itemId is required' };
  }
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  const { data, error } = await supabase
    .from('challenge_items')
    .delete()
    .eq('id', itemId.trim())
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[challengeProgramsApi] deleteChallengeItem error:', error.message);
    return mutationFailure(error, '挑戦状項目の削除に失敗しました');
  }
  if (!data) {
    return {
      ok: false,
      error: '削除できませんでした（親がdraft以外、権限不足、または対象なし）',
    };
  }

  return { ok: true };
}
