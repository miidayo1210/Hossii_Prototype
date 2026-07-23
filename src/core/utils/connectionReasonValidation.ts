import {
  isHossiiConnectionReasonEmoji,
  type HossiiConnectionReasonEmoji,
} from '../types/hossiiConnection';

/** DB `reason_text` の char_length 上限（migration と一致） */
export const MAX_CONNECTION_REASON_TEXT_LENGTH = 50;

/** DB CHECK `reason_text !~ '[\n\r\x0B\x0C]'` と同等 */
// eslint-disable-next-line no-control-regex -- DB CHECK と同じ改行・垂直タブ・フォームフィードを拒否
const NEWLINE_PATTERN = /[\n\r\x0B\x0C]/;

export type ConnectionReasonFields = {
  reasonText: string | null;
  reasonEmoji: HossiiConnectionReasonEmoji | null;
};

export type ConnectionReasonValidation =
  | { ok: true; value: ConnectionReasonFields }
  | { ok: false; message: string };

export type ConnectionReasonInput = {
  reasonText?: string | null;
  reasonEmoji?: HossiiConnectionReasonEmoji | null;
};

/**
 * connection reason のクライアント側正規化・検証。
 * 最終防衛線は DB CHECK / trigger。Production 列未適用時も、未指定フィールドは
 * insert/update payload に含めないことで既存 API 互換を保つ。
 */
export function normalizeConnectionReasonInput(
  input: ConnectionReasonInput,
): ConnectionReasonValidation {
  let reasonText: string | null = null;
  let reasonEmoji: HossiiConnectionReasonEmoji | null = null;

  if (input.reasonText !== undefined && input.reasonText !== null) {
    const trimmed = input.reasonText.trim();
    if (trimmed === '') {
      reasonText = null;
    } else {
      if (trimmed.length > MAX_CONNECTION_REASON_TEXT_LENGTH) {
        return { ok: false, message: 'reason text must be at most 50 characters' };
      }
      if (NEWLINE_PATTERN.test(trimmed)) {
        return { ok: false, message: 'reason text must not contain newlines' };
      }
      reasonText = trimmed;
    }
  } else if (input.reasonText === null) {
    reasonText = null;
  }

  if (input.reasonEmoji !== undefined && input.reasonEmoji !== null) {
    if (!isHossiiConnectionReasonEmoji(input.reasonEmoji)) {
      return { ok: false, message: 'invalid connection reason emoji' };
    }
    reasonEmoji = input.reasonEmoji;
  } else if (input.reasonEmoji === null) {
    reasonEmoji = null;
  }

  return { ok: true, value: { reasonText, reasonEmoji } };
}

/** create/update で reason 列を payload に含めるべきか */
export function hasConnectionReasonInput(input: ConnectionReasonInput): boolean {
  return input.reasonText !== undefined || input.reasonEmoji !== undefined;
}

/** 正規化済み reason を snake_case insert/update payload へ */
export function toConnectionReasonDbPayload(
  value: ConnectionReasonFields,
): { reason_text: string | null; reason_emoji: string | null } {
  return {
    reason_text: value.reasonText,
    reason_emoji: value.reasonEmoji,
  };
}

export type ConnectionReasonUpdatePayload = {
  reason_text?: string | null;
  reason_emoji?: string | null;
};

/**
 * updateConnectionReason 用の partial payload。
 * undefined = 列を payload に含めない / null = 明示クリア / 値あり = その列のみ更新。
 */
export function buildConnectionReasonUpdatePayload(
  input: ConnectionReasonInput,
):
  | { ok: true; payload: ConnectionReasonUpdatePayload }
  | { ok: false; message: string } {
  if (!hasConnectionReasonInput(input)) {
    return { ok: false, message: 'reasonText or reasonEmoji is required' };
  }

  const payload: ConnectionReasonUpdatePayload = {};

  if (input.reasonText !== undefined) {
    if (input.reasonText === null) {
      payload.reason_text = null;
    } else {
      const trimmed = input.reasonText.trim();
      if (trimmed === '') {
        payload.reason_text = null;
      } else {
        if (trimmed.length > MAX_CONNECTION_REASON_TEXT_LENGTH) {
          return { ok: false, message: 'reason text must be at most 50 characters' };
        }
        if (NEWLINE_PATTERN.test(trimmed)) {
          return { ok: false, message: 'reason text must not contain newlines' };
        }
        payload.reason_text = trimmed;
      }
    }
  }

  if (input.reasonEmoji !== undefined) {
    if (input.reasonEmoji === null) {
      payload.reason_emoji = null;
    } else if (!isHossiiConnectionReasonEmoji(input.reasonEmoji)) {
      return { ok: false, message: 'invalid connection reason emoji' };
    } else {
      payload.reason_emoji = input.reasonEmoji;
    }
  }

  return { ok: true, payload };
}
