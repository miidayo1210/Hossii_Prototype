import type { HossiiConnection } from '../types/hossiiConnection';
import type {
  CreateConnectionResult,
  DeleteConnectionResult,
  HossiiConnectionsApiError,
  UpdateConnectionReasonResult,
  UpdateConnectionStrengthResult,
} from './hossiiConnectionsApi';
import type { ConnectionMutationResult } from '../../components/SpaceScreen/connectionEditorTypes';

const DUPLICATE_CONNECTION_MESSAGE = 'この2つの Hossii はすでにつながっています';

function isDuplicateConnectionError(error: HossiiConnectionsApiError): boolean {
  if (error.code === '23505') return true;
  const message = error.message.toLowerCase();
  return message.includes('duplicate') || message.includes('unique');
}

export function formatConnectionApiError(error: HossiiConnectionsApiError): string {
  if (isDuplicateConnectionError(error)) {
    return DUPLICATE_CONNECTION_MESSAGE;
  }
  return error.message || '保存に失敗しました';
}

export function mapCreateConnectionResult(
  result: CreateConnectionResult,
): ConnectionMutationResult<HossiiConnection> {
  if (result.ok) return { ok: true, data: result.connection };
  return { ok: false, message: formatConnectionApiError(result) };
}

export function mapUpdateConnectionStrengthResult(
  result: UpdateConnectionStrengthResult,
): ConnectionMutationResult<HossiiConnection> {
  if (result.ok) return { ok: true, data: result.connection };
  return { ok: false, message: formatConnectionApiError(result) };
}

export function mapUpdateConnectionReasonResult(
  result: UpdateConnectionReasonResult,
): ConnectionMutationResult<HossiiConnection> {
  if (result.ok) return { ok: true, data: result.connection };
  return { ok: false, message: formatConnectionApiError(result) };
}

export function mapDeleteConnectionResult(
  result: DeleteConnectionResult,
): ConnectionMutationResult<{ id: string }> {
  if (result.ok) return { ok: true, data: { id: result.id } };
  return { ok: false, message: formatConnectionApiError(result) };
}
