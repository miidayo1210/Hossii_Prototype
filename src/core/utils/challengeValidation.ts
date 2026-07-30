import {
  CHALLENGE_ITEM_TYPES,
  CHALLENGE_PROGRAM_STATUSES,
  CHALLENGE_RESPONSE_TYPES,
  CHALLENGE_TITLE_MAX_LENGTH,
  type ChallengeItemType,
  type ChallengeProgramStatus,
  type ChallengeResponseType,
  type CreateChallengeItemInput,
  type CreateChallengeProgramInput,
  type UpdateChallengeItemInput,
  type UpdateChallengeProgramInput,
} from '../types/challengeProgram';

export type ChallengeValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

function requireNonEmptyId(id: string, label: string): ChallengeValidationResult<string> {
  const trimmed = id.trim();
  if (!trimmed) {
    return { ok: false, message: `${label} is required` };
  }
  return { ok: true, value: trimmed };
}

function normalizeTitle(title: string): ChallengeValidationResult<string> {
  const trimmed = title.trim();
  if (!trimmed) {
    return { ok: false, message: 'title is required' };
  }
  if (trimmed.length > CHALLENGE_TITLE_MAX_LENGTH) {
    return {
      ok: false,
      message: `title must be at most ${CHALLENGE_TITLE_MAX_LENGTH} characters`,
    };
  }
  return { ok: true, value: trimmed };
}

function normalizeNullableText(
  value: string | null | undefined,
): ChallengeValidationResult<string | null | undefined> {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null) return { ok: true, value: null };
  const trimmed = value.trim();
  return { ok: true, value: trimmed === '' ? null : trimmed };
}

export function isChallengeProgramStatus(value: unknown): value is ChallengeProgramStatus {
  return (
    typeof value === 'string' &&
    (CHALLENGE_PROGRAM_STATUSES as readonly string[]).includes(value)
  );
}

export function isChallengeItemType(value: unknown): value is ChallengeItemType {
  return typeof value === 'string' && (CHALLENGE_ITEM_TYPES as readonly string[]).includes(value);
}

export function isChallengeResponseType(value: unknown): value is ChallengeResponseType {
  return (
    typeof value === 'string' &&
    (CHALLENGE_RESPONSE_TYPES as readonly string[]).includes(value)
  );
}

export function normalizeCreateChallengeProgramInput(
  input: CreateChallengeProgramInput,
): ChallengeValidationResult<{
  spaceId: string;
  title: string;
  description: string | null;
}> {
  const spaceId = requireNonEmptyId(input.spaceId, 'spaceId');
  if (!spaceId.ok) return spaceId;

  const title = normalizeTitle(input.title);
  if (!title.ok) return title;

  const description = normalizeNullableText(input.description);
  if (!description.ok) return description;

  return {
    ok: true,
    value: {
      spaceId: spaceId.value,
      title: title.value,
      description: description.value ?? null,
    },
  };
}

export function normalizeUpdateChallengeProgramInput(
  input: UpdateChallengeProgramInput,
): ChallengeValidationResult<{
  title?: string;
  description?: string | null;
}> {
  const out: { title?: string; description?: string | null } = {};

  if (input.title !== undefined) {
    const title = normalizeTitle(input.title);
    if (!title.ok) return title;
    out.title = title.value;
  }

  if (input.description !== undefined) {
    const description = normalizeNullableText(input.description);
    if (!description.ok) return description;
    out.description = description.value ?? null;
  }

  if (out.title === undefined && out.description === undefined) {
    return { ok: false, message: 'no fields to update' };
  }

  return { ok: true, value: out };
}

export function normalizeChallengeProgramStatus(
  status: unknown,
): ChallengeValidationResult<ChallengeProgramStatus> {
  if (!isChallengeProgramStatus(status)) {
    return { ok: false, message: 'invalid challenge program status' };
  }
  return { ok: true, value: status };
}

function normalizeSortOrder(value: number | undefined): ChallengeValidationResult<number | undefined> {
  if (value === undefined) return { ok: true, value: undefined };
  if (!Number.isInteger(value) || value < 0) {
    return { ok: false, message: 'sortOrder must be an integer >= 0' };
  }
  return { ok: true, value: value };
}

export function normalizeCreateChallengeItemInput(
  input: CreateChallengeItemInput,
): ChallengeValidationResult<{
  programId: string;
  itemType: ChallengeItemType;
  title: string;
  description: string | null;
  reason: string | null;
  responseType: ChallengeResponseType;
  isRequired: boolean;
  sortOrder: number;
}> {
  const programId = requireNonEmptyId(input.programId, 'programId');
  if (!programId.ok) return programId;

  const title = normalizeTitle(input.title);
  if (!title.ok) return title;

  const itemType = input.itemType ?? 'question';
  if (!isChallengeItemType(itemType)) {
    return { ok: false, message: 'invalid challenge item type' };
  }

  const responseType = input.responseType ?? 'comment';
  if (!isChallengeResponseType(responseType)) {
    return { ok: false, message: 'invalid challenge response type' };
  }

  const description = normalizeNullableText(input.description);
  if (!description.ok) return description;

  const reason = normalizeNullableText(input.reason);
  if (!reason.ok) return reason;

  const sortOrder = normalizeSortOrder(input.sortOrder ?? 0);
  if (!sortOrder.ok) return sortOrder;

  return {
    ok: true,
    value: {
      programId: programId.value,
      itemType,
      title: title.value,
      description: description.value ?? null,
      reason: reason.value ?? null,
      responseType,
      isRequired: input.isRequired ?? true,
      sortOrder: sortOrder.value ?? 0,
    },
  };
}

export function normalizeUpdateChallengeItemInput(
  input: UpdateChallengeItemInput,
): ChallengeValidationResult<{
  itemType?: ChallengeItemType;
  title?: string;
  description?: string | null;
  reason?: string | null;
  responseType?: ChallengeResponseType;
  isRequired?: boolean;
  sortOrder?: number;
}> {
  const out: {
    itemType?: ChallengeItemType;
    title?: string;
    description?: string | null;
    reason?: string | null;
    responseType?: ChallengeResponseType;
    isRequired?: boolean;
    sortOrder?: number;
  } = {};

  if (input.title !== undefined) {
    const title = normalizeTitle(input.title);
    if (!title.ok) return title;
    out.title = title.value;
  }

  if (input.itemType !== undefined) {
    if (!isChallengeItemType(input.itemType)) {
      return { ok: false, message: 'invalid challenge item type' };
    }
    out.itemType = input.itemType;
  }

  if (input.responseType !== undefined) {
    if (!isChallengeResponseType(input.responseType)) {
      return { ok: false, message: 'invalid challenge response type' };
    }
    out.responseType = input.responseType;
  }

  if (input.description !== undefined) {
    const description = normalizeNullableText(input.description);
    if (!description.ok) return description;
    out.description = description.value ?? null;
  }

  if (input.reason !== undefined) {
    const reason = normalizeNullableText(input.reason);
    if (!reason.ok) return reason;
    out.reason = reason.value ?? null;
  }

  if (input.isRequired !== undefined) {
    out.isRequired = input.isRequired;
  }

  if (input.sortOrder !== undefined) {
    const sortOrder = normalizeSortOrder(input.sortOrder);
    if (!sortOrder.ok) return sortOrder;
    out.sortOrder = sortOrder.value;
  }

  if (
    out.title === undefined &&
    out.itemType === undefined &&
    out.responseType === undefined &&
    out.description === undefined &&
    out.reason === undefined &&
    out.isRequired === undefined &&
    out.sortOrder === undefined
  ) {
    return { ok: false, message: 'no fields to update' };
  }

  return { ok: true, value: out };
}
