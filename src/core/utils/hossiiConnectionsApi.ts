import { supabase, isSupabaseConfigured } from '../supabase';
import type {
  HossiiConnection,
  HossiiConnectionRow,
  HossiiConnectionStrength,
} from '../types/hossiiConnection';
import { isHossiiConnectionStrength } from '../types/hossiiConnection';

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

export type DeleteConnectionResult =
  | { ok: true; id: string }
  | HossiiConnectionsApiError;

export type CreateConnectionInput = {
  spaceId: string;
  paneId: string;
  sourceHossiiId: string;
  targetHossiiId: string;
  strength: HossiiConnectionStrength;
};

/** A–B / B–A を同一組み合わせとして lexicographic 正規化 */
export function normalizeConnectionPair(
  firstId: string,
  secondId: string,
): { sourceHossiiId: string; targetHossiiId: string } {
  const [sourceHossiiId, targetHossiiId] = [firstId, secondId].sort();
  return { sourceHossiiId, targetHossiiId };
}

export function rowToHossiiConnection(row: HossiiConnectionRow): HossiiConnection {
  return {
    id: row.id,
    spaceId: row.space_id,
    paneId: row.pane_id,
    sourceHossiiId: row.source_hossii_id,
    targetHossiiId: row.target_hossii_id,
    strength: row.strength,
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

  const { data, error } = await supabase
    .from('hossii_connections')
    .insert({
      space_id: spaceId,
      pane_id: paneId,
      source_hossii_id: sourceHossiiId,
      target_hossii_id: targetHossiiId,
      strength,
    })
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
