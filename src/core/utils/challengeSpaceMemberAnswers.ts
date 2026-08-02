import { isSupabaseConfigured, supabase } from '../supabase';
import type { ChallengeResponse } from '../types/challengeResponse';

/** Soft cap before 「もっと見る」 for tall mobile layouts. */
export const CHALLENGE_SPACE_MEMBER_ANSWERS_PAGE_SIZE = 5;

/**
 * Resolve display nicknames for challenge responders via space_nicknames.
 * Readable by callers who can_access_space (active members included).
 * Does not use admin-only membership nickname APIs.
 */
export async function fetchChallengeResponderNicknames(
  spaceId: string,
  userIds: string[],
): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  const uniqueIds = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
  if (!isSupabaseConfigured || !spaceId.trim() || uniqueIds.length === 0) {
    return names;
  }

  const { data, error } = await supabase
    .from('space_nicknames')
    .select('profile_id, nickname')
    .eq('space_id', spaceId.trim())
    .in('profile_id', uniqueIds);

  if (error) {
    console.error(
      '[challengeSpaceMemberAnswers] fetchChallengeResponderNicknames:',
      error.message,
    );
    return names;
  }

  for (const row of (data ?? []) as Array<{
    profile_id: string;
    nickname: string | null;
  }>) {
    const nickname = row.nickname?.trim();
    if (nickname) names[row.profile_id] = nickname;
  }
  return names;
}

export function formatSpaceMemberAnswerLabel(input: {
  userId: string;
  currentUserId: string | null | undefined;
  names: Readonly<Record<string, string>>;
}): string {
  if (input.currentUserId && input.userId === input.currentUserId) {
    return 'あなた';
  }
  const resolved = input.names[input.userId]?.trim();
  if (resolved) return resolved;
  return '参加者';
}

export function groupChallengeResponsesByItemId(
  responses: ChallengeResponse[],
): Record<string, ChallengeResponse[]> {
  const grouped: Record<string, ChallengeResponse[]> = {};
  for (const response of responses) {
    const list = grouped[response.itemId] ?? [];
    list.push(response);
    grouped[response.itemId] = list;
  }
  return grouped;
}

export function formatChallengeAnswerDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return null;
  }
}
