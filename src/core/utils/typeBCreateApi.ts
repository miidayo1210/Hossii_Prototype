import { supabase, isSupabaseConfigured } from '../supabase';
import type { EmotionKey } from '../types';

export const TYPE_B_CREATE_RPC_NAME = 'create_type_b_connected_hossii';

/** PostScreen textarea maxLength と RPC type_b_message_max_length() に合わせる */
export const TYPE_B_MESSAGE_MAX_LENGTH = 200;

export type TypeBCreateApiError = {
  ok: false;
  message: string;
  code?: string;
};

export type CreateTypeBConnectedHossiiInput = {
  idempotencyKey: string;
  spaceId: string;
  paneId: string;
  originHossiiId: string;
  newHossiiId: string;
  message: string;
  positionX: number;
  positionY: number;
  emotion?: EmotionKey | null;
  authorId?: string | null;
  authorName?: string | null;
};

export type CreateTypeBConnectedHossiiResult = {
  newHossiiId: string;
  connectionId: string;
  originHossiiId: string;
  idempotentReplay: boolean;
};

export type CreateTypeBConnectedHossiiApiResult =
  | { ok: true; result: CreateTypeBConnectedHossiiResult }
  | TypeBCreateApiError;

export type TypeBCreateRpcArgs = {
  p_idempotency_key: string;
  p_space_id: string;
  p_pane_id: string;
  p_origin_hossii_id: string;
  p_new_hossii_id: string;
  p_message: string;
  p_position_x: number;
  p_position_y: number;
  p_emotion: string | null;
  p_author_id: string | null;
  p_author_name: string | null;
};

type TypeBCreateRpcRow = {
  new_hossii_id?: unknown;
  connection_id?: unknown;
  origin_hossii_id?: unknown;
  idempotent_replay?: unknown;
};

const NOT_CONFIGURED = 'Supabase is not configured';
const RPC_NOT_AVAILABLE = 'RPC_NOT_AVAILABLE';

function toApiError(error: { message: string; code?: string }): TypeBCreateApiError {
  return { ok: false, message: error.message, code: error.code };
}

export function isTypeBCreateRpcMissingError(error: { message: string; code?: string }): boolean {
  return (
    error.code === 'PGRST202' ||
    /could not find the function.*create_type_b_connected_hossii/i.test(error.message)
  );
}

function mapRpcMissingError(): TypeBCreateApiError {
  return {
    ok: false,
    message: `${TYPE_B_CREATE_RPC_NAME} RPC is not available`,
    code: RPC_NOT_AVAILABLE,
  };
}

function requireNonEmpty(value: string | null | undefined, field: string): string | TypeBCreateApiError {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return { ok: false, message: `${field} is required` };
  }
  return trimmed;
}

/** camelCase client input → snake_case RPC args（trim 済み message） */
export function buildTypeBCreateRpcArgs(input: CreateTypeBConnectedHossiiInput): TypeBCreateRpcArgs | TypeBCreateApiError {
  const idempotencyKey = requireNonEmpty(input.idempotencyKey, 'idempotencyKey');
  if (typeof idempotencyKey !== 'string') return idempotencyKey;

  const spaceId = requireNonEmpty(input.spaceId, 'spaceId');
  if (typeof spaceId !== 'string') return spaceId;

  const paneId = requireNonEmpty(input.paneId, 'paneId');
  if (typeof paneId !== 'string') return paneId;

  const originHossiiId = requireNonEmpty(input.originHossiiId, 'originHossiiId');
  if (typeof originHossiiId !== 'string') return originHossiiId;

  const newHossiiId = requireNonEmpty(input.newHossiiId, 'newHossiiId');
  if (typeof newHossiiId !== 'string') return newHossiiId;

  const message = input.message.trim();
  if (!message) {
    return { ok: false, message: 'message must not be empty' };
  }
  if (message.length > TYPE_B_MESSAGE_MAX_LENGTH) {
    return {
      ok: false,
      message: `message must be at most ${TYPE_B_MESSAGE_MAX_LENGTH} characters`,
    };
  }

  return {
    p_idempotency_key: idempotencyKey,
    p_space_id: spaceId,
    p_pane_id: paneId,
    p_origin_hossii_id: originHossiiId,
    p_new_hossii_id: newHossiiId,
    p_message: message,
    p_position_x: input.positionX,
    p_position_y: input.positionY,
    p_emotion: input.emotion ?? null,
    p_author_id: input.authorId ?? null,
    p_author_name: input.authorName ?? null,
  };
}

function readNonEmptyString(value: unknown, field: string): string | TypeBCreateApiError {
  if (typeof value !== 'string' || value.trim() === '') {
    return { ok: false, message: `invalid RPC response: ${field}` };
  }
  return value;
}

/** jsonb RPC response → camelCase result（fail closed） */
export function parseTypeBCreateRpcResponse(data: unknown): CreateTypeBConnectedHossiiResult | TypeBCreateApiError {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, message: 'invalid RPC response' };
  }

  const row = data as TypeBCreateRpcRow;

  const newHossiiId = readNonEmptyString(row.new_hossii_id, 'new_hossii_id');
  if (typeof newHossiiId !== 'string') return newHossiiId;

  const connectionId = readNonEmptyString(row.connection_id, 'connection_id');
  if (typeof connectionId !== 'string') return connectionId;

  const originHossiiId = readNonEmptyString(row.origin_hossii_id, 'origin_hossii_id');
  if (typeof originHossiiId !== 'string') return originHossiiId;

  if (typeof row.idempotent_replay !== 'boolean') {
    return { ok: false, message: 'invalid RPC response: idempotent_replay' };
  }

  return {
    newHossiiId,
    connectionId,
    originHossiiId,
    idempotentReplay: row.idempotent_replay,
  };
}

/**
 * Type B v1: 新規 hossii + medium connection を atomic RPC 1 回で作成する。
 * insertHossii + createConnection の 2 段 API は使わない。
 */
export async function createTypeBConnectedHossii(
  input: CreateTypeBConnectedHossiiInput,
): Promise<CreateTypeBConnectedHossiiApiResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: NOT_CONFIGURED };
  }

  const rpcArgs = buildTypeBCreateRpcArgs(input);
  if ('ok' in rpcArgs) {
    return rpcArgs;
  }

  const { data, error } = await supabase.rpc(TYPE_B_CREATE_RPC_NAME, rpcArgs);

  if (error) {
    if (isTypeBCreateRpcMissingError(error)) {
      return mapRpcMissingError();
    }
    return toApiError(error);
  }

  const parsed = parseTypeBCreateRpcResponse(data);
  if ('ok' in parsed) {
    return parsed;
  }

  return { ok: true, result: parsed };
}
