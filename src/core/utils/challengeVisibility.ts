import {
  CHALLENGE_RESPONSE_VISIBILITIES,
  CHALLENGE_RESPONSE_VISIBILITY_DEFAULT,
  type ChallengeResponseVisibility,
} from '../types/challengeResponse';

/** Resolve stamped visibility: item override → program default → manager_only. */
export function resolveChallengeResponseVisibility(input: {
  itemResponseVisibility: ChallengeResponseVisibility | null | undefined;
  programDefaultResponseVisibility:
    | ChallengeResponseVisibility
    | null
    | undefined;
}): ChallengeResponseVisibility {
  return (
    input.itemResponseVisibility ??
    input.programDefaultResponseVisibility ??
    CHALLENGE_RESPONSE_VISIBILITY_DEFAULT
  );
}

export function isChallengeResponseVisibility(
  value: unknown,
): value is ChallengeResponseVisibility {
  return (
    typeof value === 'string' &&
    (CHALLENGE_RESPONSE_VISIBILITIES as readonly string[]).includes(value)
  );
}

export function coerceChallengeResponseVisibility(
  value: unknown,
  fallback: ChallengeResponseVisibility = CHALLENGE_RESPONSE_VISIBILITY_DEFAULT,
): ChallengeResponseVisibility {
  return isChallengeResponseVisibility(value) ? value : fallback;
}

export function coerceOptionalChallengeResponseVisibility(
  value: unknown,
): ChallengeResponseVisibility | null {
  if (value == null) return null;
  return isChallengeResponseVisibility(value) ? value : null;
}

export function challengeResponseVisibilityLabel(
  visibility: ChallengeResponseVisibility,
): string {
  switch (visibility) {
    case 'space_members':
      return 'スペースのみんなに共有';
    case 'manager_only':
      return '管理者にだけ共有';
    case 'self_only':
      return '自分だけに残す';
  }
}

export function challengeResponseVisibilityHelp(
  visibility: ChallengeResponseVisibility,
): string {
  switch (visibility) {
    case 'space_members':
      return '回答者本人と、このスペースの参加者・管理者が見られます';
    case 'manager_only':
      return '回答者本人と、スペース管理者だけが見られます';
    case 'self_only':
      return '回答者本人だけが見られます（管理者にも表示しません）';
  }
}

/** Short participant-facing explanation (no chooser; settings decide). */
export function challengeResponseVisibilityParticipantExplanation(
  visibility: ChallengeResponseVisibility,
): string {
  switch (visibility) {
    case 'space_members':
      return 'この回答は、スペースに参加しているみんなへ共有されます。';
    case 'manager_only':
      return 'この回答は、あなたとスペース管理者だけが見ることができます。';
    case 'self_only':
      return 'この回答は、あなただけが見ることができます。';
  }
}
