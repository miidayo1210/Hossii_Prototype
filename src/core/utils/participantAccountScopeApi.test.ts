import { describe, expect, it, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const rpc = vi.fn();
  const getSession = vi.fn();
  return { rpc, getSession };
});

vi.mock('../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getSession: h.getSession },
    rpc: h.rpc,
  },
}));

import {
  classifyIssuedParticipantRows,
  fetchIssuedParticipantAccountScope,
  isAmbiguousIssuedParticipantScopeError,
  mapIssuedParticipantScopeRpcRow,
  toIssuedParticipantCommunityMembership,
  toIssuedParticipantJoinedSpace,
  type IssuedParticipantScopeOk,
  type IssuedParticipantScopeRpcRow,
} from './participantAccountScopeApi';

const rpcRow: IssuedParticipantScopeRpcRow = {
  space_id: 'space-issued',
  space_name: '発行元スペース',
  space_url: 'issued-space',
  is_archived: false,
  community_id: 'community-issued',
  community_name: '発行元コミュニティ',
  community_slug: 'issued-community',
  space_nickname: 'にっく',
  membership_id: 'm-issued',
  joined_at: '2026-07-01T00:00:00.000Z',
  issued_at: '2026-06-01T00:00:00.000Z',
};

const scope: IssuedParticipantScopeOk = {
  ok: true,
  spaceId: 'space-issued',
  spaceName: '発行元スペース',
  spaceUrl: 'issued-space',
  isArchived: false,
  communityId: 'community-issued',
  communityName: '発行元コミュニティ',
  communitySlug: 'issued-community',
  spaceNickname: 'にっく',
  membershipId: 'm-issued',
  joinedAt: '2026-07-01T00:00:00.000Z',
};

describe('classifyIssuedParticipantRows', () => {
  it('returns not_found when there are no active rows', () => {
    expect(classifyIssuedParticipantRows(0)).toBe('not_found');
  });

  it('returns ambiguous when multiple active rows exist', () => {
    expect(classifyIssuedParticipantRows(2)).toBe('ambiguous');
    expect(classifyIssuedParticipantRows(5)).toBe('ambiguous');
  });

  it('returns ok for exactly one active row', () => {
    expect(classifyIssuedParticipantRows(1)).toBe('ok');
  });
});

describe('isAmbiguousIssuedParticipantScopeError', () => {
  it('detects RPC ambiguous exception message', () => {
    expect(isAmbiguousIssuedParticipantScopeError('ambiguous_issued_participant_scope')).toBe(true);
    expect(
      isAmbiguousIssuedParticipantScopeError('ERROR: ambiguous_issued_participant_scope'),
    ).toBe(true);
  });

  it('does not treat other errors as ambiguous', () => {
    expect(isAmbiguousIssuedParticipantScopeError('query failed')).toBe(false);
    expect(isAmbiguousIssuedParticipantScopeError(null)).toBe(false);
  });
});

describe('issued participant Account affiliation mappers', () => {
  it('maps RPC row to scope ok', () => {
    expect(mapIssuedParticipantScopeRpcRow(rpcRow)).toEqual(scope);
  });

  it('maps scope to a single community membership for Account display', () => {
    expect(toIssuedParticipantCommunityMembership(scope)).toEqual({
      communityId: 'community-issued',
      communityName: '発行元コミュニティ',
      communitySlug: 'issued-community',
      role: 'member',
      status: 'active',
      communityNickname: null,
    });
  });

  it('maps scope to a single joined space and ignores unrelated memberships by construction', () => {
    const joined = toIssuedParticipantJoinedSpace(scope);
    expect(joined.spaceId).toBe('space-issued');
    expect([joined.spaceId]).toEqual(['space-issued']);
  });
});

describe('fetchIssuedParticipantAccountScope', () => {
  beforeEach(() => {
    h.rpc.mockReset();
    h.getSession.mockReset();
  });

  it('returns not_authenticated without calling RPC when there is no session', async () => {
    h.getSession.mockResolvedValue({ data: { session: null } });
    await expect(fetchIssuedParticipantAccountScope()).resolves.toEqual({
      ok: false,
      reason: 'not_authenticated',
    });
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('calls get_my_issued_participant_scope and maps a single row', async () => {
    h.getSession.mockResolvedValue({ data: { session: { user: { id: 'uid-1' } } } });
    h.rpc.mockResolvedValue({ data: [rpcRow], error: null });
    await expect(fetchIssuedParticipantAccountScope()).resolves.toEqual(scope);
    expect(h.rpc).toHaveBeenCalledWith('get_my_issued_participant_scope');
  });

  it('returns not_found for empty RPC result (no fallback to memberships)', async () => {
    h.getSession.mockResolvedValue({ data: { session: { user: { id: 'uid-1' } } } });
    h.rpc.mockResolvedValue({ data: [], error: null });
    await expect(fetchIssuedParticipantAccountScope()).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('returns ambiguous when RPC raises ambiguous_issued_participant_scope', async () => {
    h.getSession.mockResolvedValue({ data: { session: { user: { id: 'uid-1' } } } });
    h.rpc.mockResolvedValue({
      data: null,
      error: { message: 'ambiguous_issued_participant_scope' },
    });
    await expect(fetchIssuedParticipantAccountScope()).resolves.toEqual({
      ok: false,
      reason: 'ambiguous',
    });
  });

  it('returns ambiguous when RPC unexpectedly returns multiple rows', async () => {
    h.getSession.mockResolvedValue({ data: { session: { user: { id: 'uid-1' } } } });
    h.rpc.mockResolvedValue({ data: [rpcRow, rpcRow], error: null });
    await expect(fetchIssuedParticipantAccountScope()).resolves.toEqual({
      ok: false,
      reason: 'ambiguous',
    });
  });

  it('returns query_failed for other RPC errors (no membership fallback)', async () => {
    h.getSession.mockResolvedValue({ data: { session: { user: { id: 'uid-1' } } } });
    h.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchIssuedParticipantAccountScope()).resolves.toEqual({
      ok: false,
      reason: 'query_failed',
    });
  });
});
