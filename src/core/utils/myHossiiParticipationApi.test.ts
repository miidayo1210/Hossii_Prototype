import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchParticipantEligibility,
  resolveParticipantEligibilityForTest,
} from './myHossiiParticipationApi';

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

const USER_ID = '11111111-1111-1111-1111-111111111111';
const SPACE_ID = 'space-1';

function mockFromTables(tables: Record<string, unknown>) {
  supabaseMock.from.mockImplementation((table: string) => tables[table]);
}

describe('resolveParticipantEligibilityForTest', () => {
  it('prioritizes revoked participant account', () => {
    expect(
      resolveParticipantEligibilityForTest({
        participantStatus: 'revoked',
        hasSpaceNickname: true,
      }),
    ).toBe('revoked');
  });

  it('treats active participant account as eligible', () => {
    expect(
      resolveParticipantEligibilityForTest({
        participantStatus: 'active',
        hasSpaceNickname: false,
      }),
    ).toBe('eligible');
  });

  it('uses nickname path when no participant account', () => {
    expect(
      resolveParticipantEligibilityForTest({
        participantStatus: null,
        hasSpaceNickname: true,
      }),
    ).toBe('eligible');
  });

  it('returns not_participant when no paths match', () => {
    expect(
      resolveParticipantEligibilityForTest({
        participantStatus: null,
        hasSpaceNickname: false,
      }),
    ).toBe('not_participant');
  });
});

describe('fetchParticipantEligibility', () => {
  beforeEach(() => {
    supabaseMock.configured = true;
    supabaseMock.from.mockReset();
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
      space_nicknames: {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      },
    });

    await expect(fetchParticipantEligibility(USER_ID, SPACE_ID)).resolves.toBe('eligible');
  });

  it('returns revoked when participant account is revoked', async () => {
    mockFromTables({
      space_participant_accounts: {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { status: 'revoked' }, error: null }),
            }),
          }),
        }),
      },
      space_nicknames: {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { nickname: 'nick' }, error: null }),
            }),
          }),
        }),
      },
    });

    await expect(fetchParticipantEligibility(USER_ID, SPACE_ID)).resolves.toBe('revoked');
  });

  it('returns eligible for auth uid nickname without participant account', async () => {
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
      space_nicknames: {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { nickname: 'たろう' }, error: null }),
            }),
          }),
        }),
      },
    });

    await expect(fetchParticipantEligibility(USER_ID, SPACE_ID)).resolves.toBe('eligible');
  });

  it('returns not_participant when neither path matches', async () => {
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
      space_nicknames: {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      },
    });

    await expect(fetchParticipantEligibility(USER_ID, SPACE_ID)).resolves.toBe('not_participant');
  });
});
