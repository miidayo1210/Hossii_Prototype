import { describe, expect, it } from 'vitest';
import {
  classifyIssuedParticipantRows,
  toIssuedParticipantCommunityMembership,
  toIssuedParticipantJoinedSpace,
  type IssuedParticipantScopeOk,
} from './participantAccountScopeApi';

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

describe('issued participant Account affiliation mappers', () => {
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
    expect(joined).toEqual({
      membershipId: 'm-issued',
      spaceId: 'space-issued',
      spaceNickname: 'にっく',
      joinedAt: '2026-07-01T00:00:00.000Z',
      spaceName: '発行元スペース',
      spaceUrl: 'issued-space',
      communityName: '発行元コミュニティ',
      communitySlug: 'issued-community',
      isArchived: false,
    });
    // 発行元以外の spaceId は含まれない（1 件固定）
    expect([joined.spaceId]).toEqual(['space-issued']);
  });
});
