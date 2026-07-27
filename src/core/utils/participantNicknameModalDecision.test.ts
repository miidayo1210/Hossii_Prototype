import { describe, expect, it } from 'vitest';
import {
  decideIssuedParticipantNicknameModal,
  decideParticipantNicknameModalForKnownSpace,
  resolveNicknameModalInitialValue,
} from './participantNicknameModalDecision';

const issuing = 'space-issued';
const other = 'space-other';

describe('decideIssuedParticipantNicknameModal', () => {
  it('1. hydrate未完了 → wait（modal非表示）', () => {
    expect(
      decideIssuedParticipantNicknameModal({
        spaceNicknamesReady: false,
        scope: { ok: true, spaceId: issuing, spaceName: null, spaceUrl: null, isArchived: false, communityId: 'c', communityName: 'C', communitySlug: null, spaceNickname: null, membershipId: 'm', joinedAt: '' },
        urlSpaceId: issuing,
        spaceNicknames: {},
      }),
    ).toBe('wait');
  });

  it('2. hydrate完了 + nicknameなし → open', () => {
    expect(
      decideIssuedParticipantNicknameModal({
        spaceNicknamesReady: true,
        scope: {
          ok: true,
          spaceId: issuing,
          spaceName: null,
          spaceUrl: null,
          isArchived: false,
          communityId: 'c',
          communityName: 'C',
          communitySlug: null,
          spaceNickname: null,
          membershipId: 'm',
          joinedAt: '',
        },
        urlSpaceId: issuing,
        spaceNicknames: {},
      }),
    ).toBe('open');
  });

  it('3. hydrate完了 + nicknameあり → skip', () => {
    expect(
      decideIssuedParticipantNicknameModal({
        spaceNicknamesReady: true,
        scope: {
          ok: true,
          spaceId: issuing,
          spaceName: null,
          spaceUrl: null,
          isArchived: false,
          communityId: 'c',
          communityName: 'C',
          communitySlug: null,
          spaceNickname: 'みー',
          membershipId: 'm',
          joinedAt: '',
        },
        urlSpaceId: issuing,
        spaceNicknames: { [issuing]: 'みー' },
      }),
    ).toBe('skip');
  });

  it('4. hydrate未完了→完了で nickname ありなら open にならない（skip）', () => {
    const before = decideIssuedParticipantNicknameModal({
      spaceNicknamesReady: false,
      scope: null,
      urlSpaceId: issuing,
      spaceNicknames: {},
    });
    const after = decideIssuedParticipantNicknameModal({
      spaceNicknamesReady: true,
      scope: {
        ok: true,
        spaceId: issuing,
        spaceName: null,
        spaceUrl: null,
        isArchived: false,
        communityId: 'c',
        communityName: 'C',
        communitySlug: null,
        spaceNickname: 'みー',
        membershipId: 'm',
        joinedAt: '',
      },
      urlSpaceId: issuing,
      spaceNicknames: { [issuing]: 'みー' },
    });
    expect(before).toBe('wait');
    expect(after).toBe('skip');
  });

  it('5/6/7. 再ログイン・slug・発行元 nick あり → skip', () => {
    expect(
      decideIssuedParticipantNicknameModal({
        spaceNicknamesReady: true,
        scope: {
          ok: true,
          spaceId: issuing,
          spaceName: null,
          spaceUrl: null,
          isArchived: false,
          communityId: 'c',
          communityName: 'C',
          communitySlug: null,
          spaceNickname: '保存名',
          membershipId: 'm',
          joinedAt: '',
        },
        urlSpaceId: issuing,
        spaceNicknames: { [issuing]: '保存名' },
      }),
    ).toBe('skip');
  });

  it('8. 別space nick だけ → 発行元では open', () => {
    expect(
      decideIssuedParticipantNicknameModal({
        spaceNicknamesReady: true,
        scope: {
          ok: true,
          spaceId: issuing,
          spaceName: null,
          spaceUrl: null,
          isArchived: false,
          communityId: 'c',
          communityName: 'C',
          communitySlug: null,
          spaceNickname: null,
          membershipId: 'm',
          joinedAt: '',
        },
        urlSpaceId: issuing,
        spaceNicknames: { [other]: '別空間の名' },
      }),
    ).toBe('open');
  });

  it('9. URL が別space → skip（発行元以外へ modal/保存しない）', () => {
    expect(
      decideIssuedParticipantNicknameModal({
        spaceNicknamesReady: true,
        scope: {
          ok: true,
          spaceId: issuing,
          spaceName: null,
          spaceUrl: null,
          isArchived: false,
          communityId: 'c',
          communityName: 'C',
          communitySlug: null,
          spaceNickname: null,
          membershipId: 'm',
          joinedAt: '',
        },
        urlSpaceId: other,
        spaceNicknames: {},
      }),
    ).toBe('skip');
  });

  it('10. scope not_found / ambiguous → skip（推測しない）', () => {
    expect(
      decideIssuedParticipantNicknameModal({
        spaceNicknamesReady: true,
        scope: { ok: false, reason: 'not_found' },
        urlSpaceId: issuing,
        spaceNicknames: {},
      }),
    ).toBe('skip');
    expect(
      decideIssuedParticipantNicknameModal({
        spaceNicknamesReady: true,
        scope: { ok: false, reason: 'ambiguous' },
        urlSpaceId: issuing,
        spaceNicknames: {},
      }),
    ).toBe('skip');
    expect(
      decideIssuedParticipantNicknameModal({
        spaceNicknamesReady: true,
        scope: { ok: false, reason: 'query_failed' },
        urlSpaceId: issuing,
        spaceNicknames: {},
      }),
    ).toBe('skip');
  });

  it('scope 未取得 → wait', () => {
    expect(
      decideIssuedParticipantNicknameModal({
        spaceNicknamesReady: true,
        scope: null,
        urlSpaceId: issuing,
        spaceNicknames: {},
      }),
    ).toBe('wait');
  });
});

describe('decideParticipantNicknameModalForKnownSpace', () => {
  it('hydrate前は wait', () => {
    expect(
      decideParticipantNicknameModalForKnownSpace({
        spaceNicknamesReady: false,
        issuingSpaceId: issuing,
        spaceNicknames: {},
      }),
    ).toBe('wait');
  });

  it('保存済みなら skip（再ログイン）', () => {
    expect(
      decideParticipantNicknameModalForKnownSpace({
        spaceNicknamesReady: true,
        issuingSpaceId: issuing,
        spaceNicknames: { [issuing]: 'みー' },
      }),
    ).toBe('skip');
  });
});

describe('resolveNicknameModalInitialValue', () => {
  it('11/12/13. 参加IDは space nick 以外を prefill しない（空）', () => {
    expect(
      resolveNicknameModalInitialValue({
        isIssuedParticipant: true,
        isProfileCompletion: false,
        spaceNickname: null,
        defaultNickname: 'ユーザー',
        username: 'ユーザー',
        displayName: 'Participant public-01',
      }),
    ).toBe('');
    expect(
      resolveNicknameModalInitialValue({
        isIssuedParticipant: true,
        isProfileCompletion: false,
        spaceNickname: null,
        username: 'たろう',
        displayName: 'Participant public-01',
      }),
    ).toBe('');
  });

  it('参加IDで保存済み space nick のみ初期値に使う', () => {
    expect(
      resolveNicknameModalInitialValue({
        isIssuedParticipant: true,
        isProfileCompletion: false,
        spaceNickname: 'みー',
        username: 'ユーザー',
        displayName: 'Participant public-01',
      }),
    ).toBe('みー');
  });

  it('14. 通常アカウント profile 完了は既存どおり username 等を prefill', () => {
    expect(
      resolveNicknameModalInitialValue({
        isIssuedParticipant: false,
        isProfileCompletion: true,
        username: 'たろう',
        displayName: '表示',
      }),
    ).toBe('たろう');
  });

  it('15. ゲストは space / defaultNickname の既存 prefill を維持', () => {
    expect(
      resolveNicknameModalInitialValue({
        isIssuedParticipant: false,
        isProfileCompletion: false,
        spaceNickname: '',
        defaultNickname: 'ゲスト名',
      }),
    ).toBe('ゲスト名');
  });
});
