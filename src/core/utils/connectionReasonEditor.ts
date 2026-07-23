import type { HossiiConnectionReasonEmoji } from '../types/hossiiConnection';
import {
  normalizeConnectionReasonInput,
  type ConnectionReasonInput,
} from './connectionReasonValidation';

export type ConnectionReasonDraft = {
  draftReasonText: string;
  draftReasonEmoji: HossiiConnectionReasonEmoji | null;
};

export type ConnectionReasonDraftValidation =
  | { ok: true }
  | { ok: false; message: string };

/** Popover 向けの日本語エラーメッセージ */
export function formatConnectionReasonValidationError(message: string): string {
  if (message.includes('50 characters')) {
    return '理由は50文字以内で入力してください';
  }
  if (message.includes('newlines')) {
    return '理由に改行は使えません';
  }
  if (message.includes('emoji')) {
    return '選べない絵文字です';
  }
  return message;
}

function validateDraftFields(
  draftReasonText: string,
  draftReasonEmoji: HossiiConnectionReasonEmoji | null,
): ConnectionReasonDraftValidation {
  const input: ConnectionReasonInput = {};
  if (draftReasonText.length > 0) {
    input.reasonText = draftReasonText;
  }
  if (draftReasonEmoji !== null) {
    input.reasonEmoji = draftReasonEmoji;
  }

  if (Object.keys(input).length === 0) {
    return { ok: true };
  }

  const validated = normalizeConnectionReasonInput(input);
  if (!validated.ok) {
    return { ok: false, message: formatConnectionReasonValidationError(validated.message) };
  }
  return { ok: true };
}

/** create 用: reason 未入力なら空オブジェクト、入力時のみキーを含める */
export function buildCreateReasonFields(
  draftReasonText: string,
  draftReasonEmoji: HossiiConnectionReasonEmoji | null,
):
  | { ok: true; fields: { reasonText?: string | null; reasonEmoji?: HossiiConnectionReasonEmoji | null } }
  | { ok: false; message: string } {
  const validation = validateDraftFields(draftReasonText, draftReasonEmoji);
  if (!validation.ok) return validation;

  const trimmed = draftReasonText.trim();
  const hasText = trimmed.length > 0;
  const hasEmoji = draftReasonEmoji !== null;

  if (!hasText && !hasEmoji) {
    return { ok: true, fields: {} };
  }

  const fields: { reasonText?: string | null; reasonEmoji?: HossiiConnectionReasonEmoji | null } = {};
  if (hasText) {
    fields.reasonText = trimmed;
  }
  if (hasEmoji) {
    fields.reasonEmoji = draftReasonEmoji;
  }
  return { ok: true, fields };
}

export function normalizeDraftReason(
  draftReasonText: string,
  draftReasonEmoji: HossiiConnectionReasonEmoji | null,
): { reasonText: string | null; reasonEmoji: HossiiConnectionReasonEmoji | null } {
  const trimmed = draftReasonText.trim();
  return {
    reasonText: trimmed.length > 0 ? trimmed : null,
    reasonEmoji: draftReasonEmoji,
  };
}

/** edit 用: 変更がなければ null。partial update semantics で delta のみ返す */
export function buildReasonUpdateDelta(
  original: { reasonText: string | null; reasonEmoji: HossiiConnectionReasonEmoji | null },
  draftReasonText: string,
  draftReasonEmoji: HossiiConnectionReasonEmoji | null,
):
  | { ok: true; delta: ConnectionReasonInput | null }
  | { ok: false; message: string } {
  const validation = validateDraftFields(draftReasonText, draftReasonEmoji);
  if (!validation.ok) return validation;

  const normalized = normalizeDraftReason(draftReasonText, draftReasonEmoji);
  const delta: ConnectionReasonInput = {};

  if (normalized.reasonText !== original.reasonText) {
    delta.reasonText = normalized.reasonText;
  }
  if (normalized.reasonEmoji !== original.reasonEmoji) {
    delta.reasonEmoji = normalized.reasonEmoji;
  }

  if (delta.reasonText === undefined && delta.reasonEmoji === undefined) {
    return { ok: true, delta: null };
  }

  return { ok: true, delta };
}

export function seedReasonDraftFromConnection(
  connection: { reasonText: string | null; reasonEmoji: HossiiConnectionReasonEmoji | null },
): ConnectionReasonDraft & { reasonExpanded: boolean } {
  const hasReason = Boolean(connection.reasonText?.trim() || connection.reasonEmoji);
  return {
    draftReasonText: connection.reasonText ?? '',
    draftReasonEmoji: connection.reasonEmoji,
    reasonExpanded: hasReason,
  };
}
