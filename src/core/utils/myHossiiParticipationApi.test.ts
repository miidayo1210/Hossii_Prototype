import { beforeEach, describe, expect, it, vi } from 'vitest';

const profilesApiMock = vi.hoisted(() => ({
  upsertProfile: vi.fn(async () => undefined),
  upsertSpaceNickname: vi.fn(async () => undefined),
}));

vi.mock('./profilesApi', () => ({
  upsertProfile: profilesApiMock.upsertProfile,
  upsertSpaceNickname: profilesApiMock.upsertSpaceNickname,
}));

const supabaseMock = vi.hoisted(() => ({
  configured: true,
  from: vi.fn(),
}));

vi.mock('../supabase', () => ({
  get isSupabaseConfigured() {
    return supabaseMock.configured;
  },
  supabase: {
    from: (table: string) => supabaseMock.from(table),
  },
}));

import {
  fetchParticipantEligibility,
  fetchParticipantEligibilityResult,
  getParticipantEligibilityAppearanceMessage,
  resolveParticipantEligibilityForTest,
} from './myHossiiParticipationApi';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const LEGACY_ID = 'f87e2c43-de97-4210-ad8a-5e59ccd2631e';
const SPACE_ID = '1782893187808-nc0wjrj';

function mockFromTables(tables: Record<string, unknown>) {
  supabaseMock.from.mockImplementation((table: string) => tables[table]);
}

function nicknameTable(rows: Record<string, { nickname: string } | null>) {
  return {
    select: () => ({
      eq: (column: string) => {
        if (column === 'space_id') {
          return {
            eq: (_column2: string, profileId: string) => ({
              maybeSingle: async () => {
                const row = rows[profileId] ?? null;
                return { data: row, error: null };
              },
            }),
          };
        }
        return {
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        };
      },
    }),
  };
}

describe('resolveParticipantEligibilityForTest', () => {
  it('prioritizes revoked participant account', () => {
    expect(
      resolveParticipantEligibilityForTest({
        participantStatus: 'revoked',
        hasAuthSpaceNickname: true,
      }),
    ).toEqual({ eligibility: 'revoked', reason: 'revoked' });
  });

  it('treats active participant account as eligible', () => {
    expect(
      resolveParticipantEligibilityForTest({
        participantStatus: 'active',
        hasAuthSpaceNickname: false,
      }),
    ).toEqual({ eligibility: 'eligible', reason: 'issued_participant' });
  });

  it('uses auth uid nickname path', () => {
    expect(
      resolveParticipantEligibilityForTest({
        participantStatus: null,
        hasAuthSpaceNickname: true,
      }),
    ).toEqual({ eligibility: 'eligible', reason: 'space_nickname' });
  });

  it('detects legacy nickname path', () => {
    expect(
      resolveParticipantEligibilityForTest({
        participantStatus: null,
        hasAuthSpaceNickname: false,
        hasLegacySpaceNickname: true,
      }),
    ).toEqual({ eligibility: 'eligible', reason: 'legacy_space_nickname_migrated' });
  });

  it('detects default nickname only', () => {
    expect(
      resolveParticipantEligibilityForTest({
        participantStatus: null,
        hasAuthSpaceNickname: false,
        hasDefaultNickname: true,
      }),
    ).toEqual({ eligibility: 'not_participant', reason: 'default_nickname_only' });
  });
});

describe('fetchParticipantEligibilityResult', () => {
  beforeEach(() => {
    supabaseMock.configured = true;
    supabaseMock.from.mockReset();
    profilesApiMock.upsertProfile.mockClear();
    profilesApiMock.upsertSpaceNickname.mockClear();
  });

  it('returns eligible for active participant account', async () => {
    mockFromTables({
      space_participant_accounts: {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { status: 'active' }, error: null }),
            }),
          }),
        }),
      },
      space_nicknames: nicknameTable({}),
    });

    await expect(fetchParticipantEligibilityResult(USER_ID, SPACE_ID)).resolves.toEqual({
      eligibility: 'eligible',
      reason: 'issued_participant',
    });
  });

  it('migrates legacy device profile nickname to auth uid', async () => {
    mockFromTables({
      space_participant_accounts: {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      },
      space_nicknames: nicknameTable({
        [LEGACY_ID]: { nickname: 'しづる' },
      }),
    });

    const result = await fetchParticipantEligibilityResult(USER_ID, SPACE_ID, {
      legacyProfileId: LEGACY_ID,
      defaultNickname: 'しづる',
    });

    expect(result).toEqual({
      eligibility: 'eligible',
      reason: 'legacy_space_nickname_migrated',
    });
    expect(profilesApiMock.upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: USER_ID, defaultNickname: 'しづる' }),
    );
    expect(profilesApiMock.upsertSpaceNickname).toHaveBeenCalledWith(USER_ID, SPACE_ID, 'しづる');
  });

  it('returns default_nickname_only when only common nickname exists', async () => {
    mockFromTables({
      space_participant_accounts: {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      },
      space_nicknames: nicknameTable({}),
    });

    await expect(
      fetchParticipantEligibilityResult(USER_ID, SPACE_ID, {
        defaultNickname: '共通名',
      }),
    ).resolves.toEqual({
      eligibility: 'not_participant',
      reason: 'default_nickname_only',
    });
  });

  it('returns error result instead of not_participant on API failure', async () => {
    mockFromTables({
      space_participant_accounts: {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: { message: 'boom' } }),
            }),
          }),
        }),
      },
      space_nicknames: nicknameTable({}),
    });

    await expect(fetchParticipantEligibilityResult(USER_ID, SPACE_ID)).resolves.toEqual({
      eligibility: 'error',
      reason: 'error',
    });
  });
});

describe('getParticipantEligibilityAppearanceMessage', () => {
  it('shows admin hint only for no_space_nickname', () => {
    const message = getParticipantEligibilityAppearanceMessage(
      { eligibility: 'not_participant', reason: 'no_space_nickname' },
      true,
    );
    expect(message).toContain('参加者ニックネームを設定すると');
  });

  it('shows default nickname guidance without admin-only hint', () => {
    const message = getParticipantEligibilityAppearanceMessage(
      { eligibility: 'not_participant', reason: 'default_nickname_only' },
      true,
    );
    expect(message).toContain('共通ニックネームは登録されていますが');
    expect(message).not.toContain('管理者権限だけでは');
  });

  it('shows API error message', () => {
    const message = getParticipantEligibilityAppearanceMessage(
      { eligibility: 'error', reason: 'error' },
      false,
    );
    expect(message).toContain('確認できませんでした');
  });
});

describe('fetchParticipantEligibility compatibility', () => {
  beforeEach(() => {
    supabaseMock.configured = true;
    supabaseMock.from.mockReset();
  });

  it('returns aggregated eligibility', async () => {
    mockFromTables({
      space_participant_accounts: {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      },
      space_nicknames: nicknameTable({
        [USER_ID]: { nickname: 'たろう' },
      }),
    });

    await expect(fetchParticipantEligibility(USER_ID, SPACE_ID)).resolves.toBe('eligible');
  });
});
