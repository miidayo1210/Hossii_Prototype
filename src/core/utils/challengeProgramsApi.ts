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
import type { ChallengeResponseVisibility } from '../types/challengeResponse';
import {
  normalizeChallengeProgramStatus,
  normalizeCreateChallengeItemInput,
  normalizeCreateChallengeProgramInput,
  normalizeUpdateChallengeItemInput,
  normalizeUpdateChallengeProgramInput,
} from './challengeValidation';
import {
  coerceChallengeResponseVisibility,
  coerceOptionalChallengeResponseVisibility,
} from './challengeVisibility';

export type ChallengeProgramRow = {
  id: string;
  space_id: string;
  title: string;
  description: string | null;
  status: string;
  default_response_visibility?: string | null;
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
  response_visibility?: string | null;
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
    defaultResponseVisibility: coerceChallengeResponseVisibility(
      row.default_response_visibility,
    ),
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
    responseVisibility: coerceOptionalChallengeResponseVisibility(
      row.response_visibility,
    ),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/** Insert payload for createChallengeProgram — never includes created_by or status override. */
export function buildCreateChallengeProgramPayload(input: {
  spaceId: string;
  title: string;
  description: string | null;
  defaultResponseVisibility: ChallengeResponseVisibility;
}): {
  space_id: string;
  title: string;
  description: string | null;
  default_response_visibility: ChallengeResponseVisibility;
} {
  return {
    space_id: input.spaceId,
    title: input.title,
    description: input.description,
    default_response_visibility: input.defaultResponseVisibility,
  };
}

export function buildUpdateChallengeProgramPayload(input: {
  title?: string;
  description?: string | null;
  defaultResponseVisibility?: ChallengeResponseVisibility;
}): Record<string, string | null> {
  const payload: Record<string, string | null> = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.description !== undefined) payload.description = input.description;
  if (input.defaultResponseVisibility !== undefined) {
    payload.default_response_visibility = input.defaultResponseVisibility;
  }
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
  responseVisibility: ChallengeResponseVisibility | null;
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
    response_visibility: input.responseVisibility,
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
  responseVisibility?: ChallengeResponseVisibility | null;
}): Record<string, string | number | boolean | null> {
  const payload: Record<string, string | number | boolean | null> = {};
  if (input.itemType !== undefined) payload.item_type = input.itemType;
  if (input.title !== undefined) payload.title = input.title;
  if (input.description !== undefined) payload.description = input.description;
  if (input.reason !== undefined) payload.reason = input.reason;
  if (input.responseType !== undefined) payload.response_type = input.responseType;
  if (input.isRequired !== undefined) payload.is_required = input.isRequired;
  if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;
  if (input.responseVisibility !== undefined) {
    payload.response_visibility = input.responseVisibility;
  }
  return payload;
}

const CHALLENGE_VISIBILITY_WRITE_KEYS = [
  'default_response_visibility',
  'response_visibility',
] as const;

/** True when PostgREST/Postgres reports Phase 2 visibility columns are absent. */
export function isMissingChallengeVisibilityColumnError(error: {
  message?: string;
  code?: string;
}): boolean {
  const message = (error.message ?? '').toLowerCase();
  const mentionsVisibilityColumn =
    message.includes('default_response_visibility') ||
    message.includes('response_visibility');
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    (mentionsVisibilityColumn &&
      (message.includes('column') ||
        message.includes('schema cache') ||
        message.includes('could not find')))
  );
}

export function stripChallengeVisibilityWriteKeys<
  T extends Record<string, unknown>,
>(payload: T): T {
  const next = { ...payload };
  for (const key of CHALLENGE_VISIBILITY_WRITE_KEYS) {
    delete next[key];
  }
  return next;
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

type WriteResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

/**
 * Insert/update with visibility columns; if Production lacks Phase 2 columns,
 * retry once without those keys so existing admin create/update still works.
 */
async function writeChallengePayload(options: {
  payload: Record<string, unknown>;
  write: (payload: Record<string, unknown>) => Promise<WriteResult>;
  emptyAfterStripError: string;
}): Promise<WriteResult> {
  const first = await options.write(options.payload);
  if (!first.error || !isMissingChallengeVisibilityColumnError(first.error)) {
    return first;
  }
  const stripped = stripChallengeVisibilityWriteKeys(options.payload);
  if (Object.keys(stripped).length === 0) {
    return {
      data: null,
      error: { message: options.emptyAfterStripError, code: first.error.code },
    };
  }
  return options.write(stripped);
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
  const { data, error } = await writeChallengePayload({
    payload,
    emptyAfterStripError: '公開範囲設定はこの環境ではまだ利用できません',
    write: async (nextPayload) => {
      const result = await supabase
        .from('challenge_programs')
        .insert(nextPayload)
        .select('*')
        .maybeSingle();
      return { data: result.data, error: result.error };
    },
  });

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
  const { data, error } = await writeChallengePayload({
    payload,
    emptyAfterStripError: '公開範囲設定はこの環境ではまだ利用できません',
    write: async (nextPayload) => {
      const result = await supabase
        .from('challenge_programs')
        .update(nextPayload)
        .eq('id', programId.trim())
        .select('*')
        .maybeSingle();
      return { data: result.data, error: result.error };
    },
  });

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
  const { data, error } = await writeChallengePayload({
    payload,
    emptyAfterStripError: '公開範囲設定はこの環境ではまだ利用できません',
    write: async (nextPayload) => {
      const result = await supabase
        .from('challenge_items')
        .insert(nextPayload)
        .select('*')
        .maybeSingle();
      return { data: result.data, error: result.error };
    },
  });

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
  const { data, error } = await writeChallengePayload({
    payload,
    emptyAfterStripError: '公開範囲設定はこの環境ではまだ利用できません',
    write: async (nextPayload) => {
      const result = await supabase
        .from('challenge_items')
        .update(nextPayload)
        .eq('id', itemId.trim())
        .select('*')
        .maybeSingle();
      return { data: result.data, error: result.error };
    },
  });

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
