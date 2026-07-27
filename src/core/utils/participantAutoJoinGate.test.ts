import { describe, it, expect } from 'vitest';
import { shouldAutoJoinSpace } from './participantAutoJoinGate';
import type { IssuedParticipantScopeResult } from './participantAccountScopeApi';

const issuedOk: IssuedParticipantScopeResult = {
  ok: true,
  spaceId: 'space-issued',
  spaceName: '発行元',
  spaceUrl: 'issued',
  isArchived: false,
  communityId: 'community-1',
  communityName: 'Comm',
  communitySlug: 'comm',
  spaceNickname: 'にっく',
  membershipId: 'mem-1',
  joinedAt: '2026-07-01T00:00:00.000Z',
};

describe('shouldAutoJoinSpace', () => {
  it('通常アカウント + public → auto join 可', () => {
    expect(
      shouldAutoJoinSpace({
        baseAllowAutoJoin: true,
        isIssuedParticipant: false,
        activeSpaceId: 'space-other',
        affiliationLoading: false,
        issuedParticipantScope: null,
      }),
    ).toBe(true);
  });

  it('baseAllowAutoJoin=false（invite_only / personal 等）→ 不可', () => {
    expect(
      shouldAutoJoinSpace({
        baseAllowAutoJoin: false,
        isIssuedParticipant: false,
        activeSpaceId: 'space-shared',
        affiliationLoading: false,
        issuedParticipantScope: null,
      }),
    ).toBe(false);
  });

  it('active space 未確定 → 不可', () => {
    expect(
      shouldAutoJoinSpace({
        baseAllowAutoJoin: true,
        isIssuedParticipant: false,
        activeSpaceId: null,
        affiliationLoading: false,
        issuedParticipantScope: null,
      }),
    ).toBe(false);
  });

  it('参加ID + 発行元 public → auto join 可', () => {
    expect(
      shouldAutoJoinSpace({
        baseAllowAutoJoin: true,
        isIssuedParticipant: true,
        activeSpaceId: 'space-issued',
        affiliationLoading: false,
        issuedParticipantScope: issuedOk,
      }),
    ).toBe(true);
  });

  it('参加ID + 発行元外 public → auto join 不可', () => {
    expect(
      shouldAutoJoinSpace({
        baseAllowAutoJoin: true,
        isIssuedParticipant: true,
        activeSpaceId: 'space-other',
        affiliationLoading: false,
        issuedParticipantScope: issuedOk,
      }),
    ).toBe(false);
  });

  it('参加ID + scope loading → auto join 不可', () => {
    expect(
      shouldAutoJoinSpace({
        baseAllowAutoJoin: true,
        isIssuedParticipant: true,
        activeSpaceId: 'space-issued',
        affiliationLoading: true,
        issuedParticipantScope: null,
      }),
    ).toBe(false);
  });

  it('参加ID + scope null（未取得）→ auto join 不可', () => {
    expect(
      shouldAutoJoinSpace({
        baseAllowAutoJoin: true,
        isIssuedParticipant: true,
        activeSpaceId: 'space-issued',
        affiliationLoading: false,
        issuedParticipantScope: null,
      }),
    ).toBe(false);
  });

  it.each([
    'not_found',
    'ambiguous',
    'query_failed',
    'space_missing',
    'community_missing',
    'not_authenticated',
    'not_configured',
  ] as const)('参加ID + scope %s → auto join 不可', (reason) => {
    expect(
      shouldAutoJoinSpace({
        baseAllowAutoJoin: true,
        isIssuedParticipant: true,
        activeSpaceId: 'space-issued',
        affiliationLoading: false,
        issuedParticipantScope: { ok: false, reason },
      }),
    ).toBe(false);
  });

  it('account 切替後に古い issued space を使わない（scope が新発行元）', () => {
    const nextScope: IssuedParticipantScopeResult = {
      ...issuedOk,
      spaceId: 'space-new-issued',
    };
    expect(
      shouldAutoJoinSpace({
        baseAllowAutoJoin: true,
        isIssuedParticipant: true,
        activeSpaceId: 'space-issued',
        affiliationLoading: false,
        issuedParticipantScope: nextScope,
      }),
    ).toBe(false);
    expect(
      shouldAutoJoinSpace({
        baseAllowAutoJoin: true,
        isIssuedParticipant: true,
        activeSpaceId: 'space-new-issued',
        affiliationLoading: false,
        issuedParticipantScope: nextScope,
      }),
    ).toBe(true);
  });

  it('通常アカウントは scope loading 中でも base が true なら join 可', () => {
    expect(
      shouldAutoJoinSpace({
        baseAllowAutoJoin: true,
        isIssuedParticipant: false,
        activeSpaceId: 'space-other',
        affiliationLoading: true,
        issuedParticipantScope: null,
      }),
    ).toBe(true);
  });
});
