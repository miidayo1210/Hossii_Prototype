import {
  CHALLENGE_RESPONSE_COMMENT_MAX_LENGTH,
  CHALLENGE_RESPONSE_VISIBILITIES,
  type ChallengeResponseVisibility,
  type CreateChallengeResponseInput,
  type UpdateChallengeResponseInput,
} from '../types/challengeResponse';

export type NormalizeOk<T> = { ok: true; value: T };
export type NormalizeErr = { ok: false; message: string };
export type NormalizeResult<T> = NormalizeOk<T> | NormalizeErr;

function requireId(value: string | undefined, label: string): NormalizeResult<string> {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return { ok: false, message: `${label} is required` };
  return { ok: true, value: trimmed };
}

export function normalizeChallengeResponseVisibility(
  value: unknown,
): NormalizeResult<ChallengeResponseVisibility> {
  if (
    typeof value === 'string' &&
    (CHALLENGE_RESPONSE_VISIBILITIES as readonly string[]).includes(value)
  ) {
    return { ok: true, value: value as ChallengeResponseVisibility };
  }
  return { ok: false, message: 'visibility must be self_only or manager_only' };
}

export function normalizeChallengeResponseComment(
  value: unknown,
): NormalizeResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, message: 'comment is required' };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, message: 'comment must not be empty' };
  }
  if (trimmed.length > CHALLENGE_RESPONSE_COMMENT_MAX_LENGTH) {
    return {
      ok: false,
      message: `comment must be at most ${CHALLENGE_RESPONSE_COMMENT_MAX_LENGTH} characters`,
    };
  }
  return { ok: true, value: trimmed };
}

export function normalizeCreateChallengeResponseInput(
  input: CreateChallengeResponseInput,
): NormalizeResult<{
  itemId: string;
  comment: string;
  visibility: ChallengeResponseVisibility;
}> {
  const itemId = requireId(input.itemId, 'itemId');
  if (!itemId.ok) return itemId;

  const comment = normalizeChallengeResponseComment(input.comment);
  if (!comment.ok) return comment;

  const visibility = normalizeChallengeResponseVisibility(
    input.visibility ?? 'manager_only',
  );
  if (!visibility.ok) return visibility;

  return {
    ok: true,
    value: {
      itemId: itemId.value,
      comment: comment.value,
      visibility: visibility.value,
    },
  };
}

export function normalizeUpdateChallengeResponseInput(
  input: UpdateChallengeResponseInput,
): NormalizeResult<{
  comment?: string;
  visibility?: ChallengeResponseVisibility;
}> {
  const value: { comment?: string; visibility?: ChallengeResponseVisibility } = {};

  if (input.comment !== undefined) {
    const comment = normalizeChallengeResponseComment(input.comment);
    if (!comment.ok) return comment;
    value.comment = comment.value;
  }

  if (input.visibility !== undefined) {
    const visibility = normalizeChallengeResponseVisibility(input.visibility);
    if (!visibility.ok) return visibility;
    value.visibility = visibility.value;
  }

  if (value.comment === undefined && value.visibility === undefined) {
    return { ok: false, message: 'no updatable fields provided' };
  }

  return { ok: true, value };
}
