import { supabase, isSupabaseConfigured } from '../supabase';
import type { ParticipantEligibility } from './myHossiiAppearance';

type ParticipantAccountRow = {
  status: string;
};

/**
 * 対象スペースでの参加者資格を判定する。
 * - 有効な space_participant_accounts → eligible
 * - revoked → revoked
 * - auth uid の space_nicknames → eligible
 * - それ以外 → not_participant
 */
export async function fetchParticipantEligibility(
  userId: string,
  spaceId: string,
): Promise<ParticipantEligibility> {
  if (!userId || !spaceId) return 'not_participant';

  if (!isSupabaseConfigured) {
    return 'not_participant';
  }

  const [participantResult, nicknameResult] = await Promise.all([
    supabase
      .from('space_participant_accounts')
      .select('status')
      .eq('space_id', spaceId)
      .eq('auth_user_id', userId)
      .maybeSingle(),
    supabase
      .from('space_nicknames')
      .select('nickname')
      .eq('space_id', spaceId)
      .eq('profile_id', userId)
      .maybeSingle(),
  ]);

  if (participantResult.error) {
    console.error(
      '[myHossiiParticipationApi] participant lookup error:',
      participantResult.error.message,
    );
    throw participantResult.error;
  }

  if (nicknameResult.error) {
    console.error(
      '[myHossiiParticipationApi] nickname lookup error:',
      nicknameResult.error.message,
    );
    throw nicknameResult.error;
  }

  const participant = participantResult.data as ParticipantAccountRow | null;
  if (participant) {
    if (participant.status === 'revoked') return 'revoked';
    if (participant.status === 'active') return 'eligible';
  }

  const nickname = nicknameResult.data as { nickname?: string } | null;
  if (nickname && nickname.nickname?.trim()) {
    return 'eligible';
  }

  return 'not_participant';
}

/** @internal テスト用 */
export function resolveParticipantEligibilityForTest(params: {
  participantStatus: 'active' | 'revoked' | null;
  hasSpaceNickname: boolean;
}): ParticipantEligibility {
  if (params.participantStatus === 'revoked') return 'revoked';
  if (params.participantStatus === 'active') return 'eligible';
  if (params.hasSpaceNickname) return 'eligible';
  return 'not_participant';
}
