import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  configured: true,
  invoke: vi.fn(),
  from: vi.fn(),
}));

vi.mock('../supabase', () => ({
  get isSupabaseConfigured() {
    return supabaseMock.configured;
  },
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => supabaseMock.invoke(...args),
    },
    from: (table: string) => supabaseMock.from(table),
    rpc: vi.fn(),
  },
}));

function participantAccountsTable(rows: Array<Record<string, unknown>>) {
  return {
    select: () => ({
      eq: () => ({
        order: async () => ({ data: rows, error: null }),
      }),
    }),
  };
}

import {
  issueParticipantAccount,
  issueParticipantAccountsBulk,
  regenerateParticipantPassword,
  revokeParticipantAccount,
  fetchParticipantAccountManagementSnapshot,
} from './participantAccountsApi';

const SPACE_ID = 'space-123';

describe('participantAccountsApi edge actions', () => {
  beforeEach(() => {
    supabaseMock.invoke.mockReset();
    supabaseMock.from.mockReset();
  });

  it('issues a single account via issue action', async () => {
    supabaseMock.invoke.mockResolvedValue({
      data: { loginId: 'demo-01', password: 'pass1111', slotNumber: 1 },
      error: null,
    });

    const result = await issueParticipantAccount(SPACE_ID, 1, {
      linkCommunityMembership: true,
      linkSpaceMembership: false,
    });

    expect(result.slotNumber).toBe(1);
    expect(supabaseMock.invoke).toHaveBeenCalledWith('issue-participant-account', {
      body: {
        spaceId: SPACE_ID,
        action: 'issue',
        slotNumber: 1,
        count: undefined,
        linkCommunityMembership: true,
        linkSpaceMembership: false,
      },
    });
  });

  it('issues bulk accounts via issue_bulk action', async () => {
    supabaseMock.invoke.mockResolvedValue({
      data: {
        issued: [
          { loginId: 'demo-01', password: 'pass1111', slotNumber: 1 },
          { loginId: 'demo-02', password: 'pass2222', slotNumber: 2 },
        ],
        count: 2,
      },
      error: null,
    });

    const result = await issueParticipantAccountsBulk(SPACE_ID, 2);

    expect(result.count).toBe(2);
    expect(result.issued).toHaveLength(2);
    expect(supabaseMock.invoke).toHaveBeenCalledWith('issue-participant-account', {
      body: {
        spaceId: SPACE_ID,
        action: 'issue_bulk',
        slotNumber: undefined,
        count: 2,
        linkCommunityMembership: false,
        linkSpaceMembership: false,
      },
    });
  });

  it('preserves partial bulk responses with issued accounts', async () => {
    supabaseMock.invoke.mockResolvedValue({
      data: {
        issued: [{ loginId: 'demo-01', password: 'pass1111', slotNumber: 1 }],
        count: 1,
        partial: true,
        error: 'Failed to create auth user',
      },
      error: null,
    });

    const result = await issueParticipantAccountsBulk(SPACE_ID, 3);

    expect(result.partial).toBe(true);
    expect(result.count).toBe(1);
    expect(result.error).toMatch(/Failed to create auth user/);
  });

  it('keeps regenerate action unchanged', async () => {
    supabaseMock.invoke.mockResolvedValue({
      data: { loginId: 'demo-03', password: 'newpass1', slotNumber: 3 },
      error: null,
    });

    await regenerateParticipantPassword(SPACE_ID, 3);

    expect(supabaseMock.invoke).toHaveBeenCalledWith('issue-participant-account', {
      body: {
        spaceId: SPACE_ID,
        action: 'regenerate',
        slotNumber: 3,
        count: undefined,
        linkCommunityMembership: false,
        linkSpaceMembership: false,
      },
    });
  });

  it('keeps revoke action unchanged', async () => {
    supabaseMock.invoke.mockResolvedValue({
      data: { slotNumber: 4, revoked: true },
      error: null,
    });

    await revokeParticipantAccount(SPACE_ID, 4);

    expect(supabaseMock.invoke).toHaveBeenCalledWith('issue-participant-account', {
      body: {
        spaceId: SPACE_ID,
        action: 'revoke',
        slotNumber: 4,
        count: undefined,
        linkCommunityMembership: false,
        linkSpaceMembership: false,
      },
    });
  });
});

describe('fetchParticipantAccountManagementSnapshot', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
  });

  it('returns active accounts and all occupied slots including revoked', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table !== 'space_participant_accounts') {
        throw new Error(`unexpected table ${table}`);
      }
      return participantAccountsTable([
        {
          id: 'a1',
          space_id: SPACE_ID,
          slot_number: 1,
          login_id: 'demo-01',
          auth_user_id: 'auth-1',
          status: 'active',
          first_login_at: null,
          issued_at: '2026-07-21T00:00:00.000Z',
          issued_by: null,
        },
        {
          id: 'a2',
          space_id: SPACE_ID,
          slot_number: 2,
          login_id: 'demo-02',
          auth_user_id: 'auth-2',
          status: 'revoked',
          first_login_at: null,
          issued_at: '2026-07-21T00:00:00.000Z',
          issued_by: null,
        },
      ]);
    });

    const snapshot = await fetchParticipantAccountManagementSnapshot(SPACE_ID);

    expect(snapshot.activeAccounts).toHaveLength(1);
    expect(snapshot.activeAccounts[0]?.slotNumber).toBe(1);
    expect(snapshot.occupiedSlotNumbers).toEqual([1, 2]);
  });
});
