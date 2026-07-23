import { supabase, isSupabaseConfigured } from '../supabase';
import type {
  HossiiConnection,
  HossiiConnectionRow,
  HossiiConnectionStrength,
  HossiiConnectionReasonEmoji,
} from '../types/hossiiConnection';
import {
  isHossiiConnectionStrength,
  isHossiiConnectionReasonEmoji,
} from '../types/hossiiConnection';
import {
  hasConnectionReasonInput,
  normalizeConnectionReasonInput,
  toConnectionReasonDbPayload,
} from './connectionReasonValidation';

export type HossiiConnectionsApiError = {
  ok: false;
  message: string;
  code?: string;
};

export type FetchConnectionsResult =
  | { ok: true; connections: HossiiConnection[] }
  | HossiiConnectionsApiError;

export type CreateConnectionResult =
  | { ok: true; connection: HossiiConnection }
  | HossiiConnectionsApiError;

export type UpdateConnectionStrengthResult =
  | { ok: true; connection: HossiiConnection }
  | HossiiConnectionsApiError;

export type UpdateConnectionReasonResult =
  | { ok: true; connection: HossiiConnection }
  | HossiiConnectionsApiError;

export type DeleteConnectionResult =
  | { ok: true; id: string }
  | HossiiConnectionsApiError;

export type CreateConnectionInput = {
  spaceId: string;
  paneId: string;
  sourceHossiiId: string;
  targetHossiiId: string;
  strength: HossiiConnectionStrength;
  reasonText?: string | null;
  reasonEmoji?: HossiiConnectionReasonEmoji | null;
};

export type UpdateConnectionReasonInput = {
  connectionId: string;
  reasonText?: string | null;
  reasonEmoji?: HossiiConnectionReasonEmoji | null;
};

/** A–B / B–A を同一組み合わせとして lexicographic 正規化 */
export function normalizeConnectionPair(
  firstId: string,
  secondId: string,
): { sourceHossiiId: string; targetHossiiId: string } {
  const [sourceHossiiId, targetHossiiId] = [firstId, secondId].sort();
  return { sourceHossiiId, targetHossiiId };
}

function mapReasonEmojiFromRow(value: string | null | undefined): HossiiConnectionReasonEmoji | null {
  if (value == null) return null;
  return isHossiiConnectionReasonEmoji(value) ? value : null;
}

export function rowToHossiiConnection(row: HossiiConnectionRow): HossiiConnection {
  return {
    id: row.id,
    spaceId: row.space_id,
    paneId: row.pane_id,
    sourceHossiiId: row.source_hossii_id,
    targetHossiiId: row.target_hossii_id,
    strength: row.strength,
    reasonText: row.reason_text ?? null,
    reasonEmoji: mapReasonEmojiFromRow(row.reason_emoji),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapConnectionRows(data: unknown): HossiiConnection[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((row): row is HossiiConnectionRow => row != null && typeof row === 'object')
    .map(rowToHossiiConnection);
}

function mapSingleConnectionRow(data: unknown): HossiiConnection | null {
  const row = (Array.isArray(data) ? data[0] : data) as HossiiConnectionRow | null | undefined;
  if (!row?.id) return null;
  return rowToHossiiConnection(row);
}

function toApiError(error: { message: string; code?: string }): HossiiConnectionsApiError {
  return { ok: false, message: error.message, code: error.code };
}

function buildReasonPayloadFromInput(
  input: CreateConnectionInput | UpdateConnectionReasonInput,
): { ok: true; payload: { reason_text: string | null; reason_emoji: string | null } } | HossiiConnectionsApiError {
  if (!hasConnectionReasonInput(input)) {
    return {
      ok: true,
      payload: { reason_text: null, reason_emoji: null },
    };
  }

  const validated = normalizeConnectionReasonInput(input);
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  return { ok: true, payload: toConnectionReasonDbPayload(validated.value) };
}

export async function fetchConnections(
  spaceId: string,
  paneId: string,
): Promise<FetchConnectionsResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: 'Supabase is not configured' };
  }
  if (!spaceId || !paneId) {
    return { ok: false, message: 'spaceId and paneId are required' };
  }

  const { data, error } = await supabase
    .from('hossii_connections')
    .select('*')
    .eq('space_id', spaceId)
    .eq('pane_id', paneId)
    .order('created_at', { ascending: true });

  if (error) {
    return toApiError(error);
  }

  return { ok: true, connections: mapConnectionRows(data) };
}

export async function createConnection(
  input: CreateConnectionInput,
): Promise<CreateConnectionResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: 'Supabase is not configured' };
  }

  const { spaceId, paneId, strength } = input;
  if (!spaceId || !paneId) {
    return { ok: false, message: 'spaceId and paneId are required' };
  }
  if (!isHossiiConnectionStrength(strength)) {
    return { ok: false, message: 'invalid connection strength' };
  }

  const { sourceHossiiId, targetHossiiId } = normalizeConnectionPair(
    input.sourceHossiiId,
    input.targetHossiiId,
  );

  if (sourceHossiiId === targetHossiiId) {
    return { ok: false, message: 'cannot connect hossii to itself' };
  }

  const insertPayload: Record<string, unknown> = {
    space_id: spaceId,
    pane_id: paneId,
    source_hossii_id: sourceHossiiId,
    target_hossii_id: targetHossiiId,
    strength,
  };

  if (hasConnectionReasonInput(input)) {
    const reasonResult = buildReasonPayloadFromInput(input);
    if (!reasonResult.ok) {
      return reasonResult;
    }
    Object.assign(insertPayload, reasonResult.payload);
  }

  const { data, error } = await supabase
    .from('hossii_connections')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    return toApiError(error);
  }

  const connection = mapSingleConnectionRow(data);
  if (!connection) {
    return { ok: false, message: 'connection row not returned' };
  }

  return { ok: true, connection };
}

export async function updateConnectionStrength(
  connectionId: string,
  strength: HossiiConnectionStrength,
): Promise<UpdateConnectionStrengthResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: 'Supabase is not configured' };
  }
  if (!connectionId) {
    return { ok: false, message: 'connectionId is required' };
  }
  if (!isHossiiConnectionStrength(strength)) {
    return { ok: false, message: 'invalid connection strength' };
  }

  const { data, error } = await supabase
    .from('hossii_connections')
    .update({ strength })
    .eq('id', connectionId)
    .select('*')
    .single();

  if (error) {
    return toApiError(error);
  }

  const connection = mapSingleConnectionRow(data);
  if (!connection) {
    return { ok: false, message: 'connection row not returned' };
  }

  return { ok: true, connection };
}

export async function updateConnectionReason(
  input: UpdateConnectionReasonInput,
): Promise<UpdateConnectionReasonResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: 'Supabase is not configured' };
  }
  if (!input.connectionId) {
    return { ok: false, message: 'connectionId is required' };
  }
  if (!hasConnectionReasonInput(input)) {
    return { ok: false, message: 'reasonText or reasonEmoji is required' };
  }

  const reasonResult = buildReasonPayloadFromInput(input);
  if (!reasonResult.ok) {
    return reasonResult;
  }

  const { data, error } = await supabase
    .from('hossii_connections')
    .update(reasonResult.payload)
    .eq('id', input.connectionId)
    .select('*')
    .single();

  if (error) {
    return toApiError(error);
  }

  const connection = mapSingleConnectionRow(data);
  if (!connection) {
    return { ok: false, message: 'connection row not returned' };
  }

  return { ok: true, connection };
}

export async function deleteConnection(connectionId: string): Promise<DeleteConnectionResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: 'Supabase is not configured' };
  }
  if (!connectionId) {
    return { ok: false, message: 'connectionId is required' };
  }

  const { error } = await supabase.from('hossii_connections').delete().eq('id', connectionId);

  if (error) {
    return toApiError(error);
  }

  return { ok: true, id: connectionId };
}
