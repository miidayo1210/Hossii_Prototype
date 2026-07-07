import { upsertProfile, upsertSpaceNickname } from './profilesApi';
import { supabase, isSupabaseConfigured } from '../supabase';

/** 対象スペースでの参加者資格（集約） */
export type ParticipantEligibility = 'eligible' | 'not_participant' | 'revoked' | 'error';

export type ParticipantEligibilityReason =
  | 'space_nickname'
  | 'issued_participant'
  | 'revoked'
  | 'legacy_space_nickname_migrated'
  | 'no_space_nickname'
  | 'default_nickname_only'
  | 'error';

export type ParticipantEligibilityResult = {
  eligibility: ParticipantEligibility;
  reason: ParticipantEligibilityReason;
};

type ParticipantAccountRow = {
  status: string;
};

type NicknameRow = {
  nickname?: string;
};

export type FetchParticipantEligibilityOptions = {
  /** 端末 profiles.id。旧実装で保存された space_nicknames の移行判定に使う */
  legacyProfileId?: string | null;
  /** 共通ニックネームのみ存在する可能性の参照用 */
  defaultNickname?: string | null;
};

async function fetchNicknameRow(
  profileId: string,
  spaceId: string,
): Promise<NicknameRow | null> {
  const { data, error } = await supabase
    .from('space_nicknames')
    .select('nickname')
    .eq('space_id', spaceId)
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) throw error;
  return data as NicknameRow | null;
}

async function migrateLegacySpaceNickname(
  authUserId: string,
  _legacyProfileId: string,
  spaceId: string,
  nickname: string,
  defaultNickname?: string | null,
): Promise<void> {
  await upsertProfile({
    id: authUserId,
    defaultNickname: defaultNickname?.trim() || nickname.trim(),
    createdAt: new Date(),
  });
  await upsertSpaceNickname(authUserId, spaceId, nickname.trim());
}

/**
 * 対象スペースでの参加者資格を詳細付きで判定する。
 */
export async function fetchParticipantEligibilityResult(
  userId: string,
  spaceId: string,
  options: FetchParticipantEligibilityOptions = {},
): Promise<ParticipantEligibilityResult> {
  if (!userId || !spaceId) {
    return { eligibility: 'not_participant', reason: 'no_space_nickname' };
  }

  if (!isSupabaseConfigured) {
    return { eligibility: 'not_participant', reason: 'no_space_nickname' };
  }

  try {
    const { data: participantData, error: participantError } = await supabase
      .from('space_participant_accounts')
      .select('status')
      .eq('space_id', spaceId)
      .eq('auth_user_id', userId)
      .maybeSingle();

    if (participantError) throw participantError;

    const participant = participantData as ParticipantAccountRow | null;
    if (participant?.status === 'revoked') {
      return { eligibility: 'revoked', reason: 'revoked' };
    }
    if (participant?.status === 'active') {
      return { eligibility: 'eligible', reason: 'issued_participant' };
    }

    const authNickname = await fetchNicknameRow(userId, spaceId);
    if (authNickname?.nickname?.trim()) {
      return { eligibility: 'eligible', reason: 'space_nickname' };
    }

    const legacyProfileId = options.legacyProfileId?.trim();
    if (legacyProfileId && legacyProfileId !== userId) {
      const legacyNickname = await fetchNicknameRow(legacyProfileId, spaceId);
      if (legacyNickname?.nickname?.trim()) {
        await migrateLegacySpaceNickname(
          userId,
          legacyProfileId,
          spaceId,
          legacyNickname.nickname,
          options.defaultNickname,
        );
        return {
          eligibility: 'eligible',
          reason: 'legacy_space_nickname_migrated',
        };
      }
    }

    const defaultNickname = options.defaultNickname?.trim();
    if (defaultNickname) {
      return { eligibility: 'not_participant', reason: 'default_nickname_only' };
    }

    return { eligibility: 'not_participant', reason: 'no_space_nickname' };
  } catch (error) {
    console.error('[myHossiiParticipationApi] eligibility error:', error);
    return { eligibility: 'error', reason: 'error' };
  }
}

/** 互換用の集約結果のみ返す */
export async function fetchParticipantEligibility(
  userId: string,
  spaceId: string,
  options?: FetchParticipantEligibilityOptions,
): Promise<ParticipantEligibility> {
  const result = await fetchParticipantEligibilityResult(userId, spaceId, options);
  return result.eligibility;
}

/** @internal テスト用 */
export function resolveParticipantEligibilityForTest(params: {
  participantStatus: 'active' | 'revoked' | null;
  hasAuthSpaceNickname: boolean;
  hasLegacySpaceNickname?: boolean;
  hasDefaultNickname?: boolean;
}): ParticipantEligibilityResult {
  if (params.participantStatus === 'revoked') {
    return { eligibility: 'revoked', reason: 'revoked' };
  }
  if (params.participantStatus === 'active') {
    return { eligibility: 'eligible', reason: 'issued_participant' };
  }
  if (params.hasAuthSpaceNickname) {
    return { eligibility: 'eligible', reason: 'space_nickname' };
  }
  if (params.hasLegacySpaceNickname) {
    return { eligibility: 'eligible', reason: 'legacy_space_nickname_migrated' };
  }
  if (params.hasDefaultNickname) {
    return { eligibility: 'not_participant', reason: 'default_nickname_only' };
  }
  return { eligibility: 'not_participant', reason: 'no_space_nickname' };
}

/** @internal テスト用 */
export function getParticipantEligibilityAppearanceMessage(
  result: ParticipantEligibilityResult,
  isAdmin: boolean,
): string | null {
  if (result.eligibility === 'error') {
    return 'このスペースでの登場状態を確認できませんでした。時間をおいて、もう一度お試しください。';
  }

  if (result.reason === 'default_nickname_only') {
    return '共通ニックネームは登録されていますが、このスペースで使うニックネームがまだ設定されていません。';
  }

  if (result.eligibility === 'not_participant' && result.reason === 'no_space_nickname') {
    const base =
      'マイHossiiは登録されていますが、このスペースの参加者として登録されていないため、現在は登場できません。';
    if (!isAdmin) return base;
    return `${base}\n管理者権限だけでは、スペースの参加者としては扱われません。このスペースで参加者ニックネームを設定すると、登場できるようになります。`;
  }

  return null;
}
