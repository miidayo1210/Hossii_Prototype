import { describe, expect, it } from 'vitest';
import {
  hasNicknameForSpaceGate,
  hasRegisteredSpaceNickname,
  isPlaceholderUsername,
  sanitizeMembershipNicknameCandidate,
  shouldShowNicknameModalForSpace,
} from './spaceNicknameGate';

describe('spaceNicknameGate', () => {
  it('detects placeholder username', () => {
    expect(isPlaceholderUsername('ユーザー')).toBe(true);
    expect(isPlaceholderUsername(' ユーザー ')).toBe(true);
    expect(isPlaceholderUsername('みー')).toBe(false);
    expect(isPlaceholderUsername('')).toBe(false);
    expect(isPlaceholderUsername(null)).toBe(false);
  });

  it('participant + no space nickname → show modal', () => {
    expect(
      shouldShowNicknameModalForSpace({
        spaceId: 'space-1',
        spaceNicknames: {},
        isIssuedParticipant: true,
        username: undefined,
      }),
    ).toBe(true);
  });

  it('participant + username「ユーザー」+ no space nickname → show modal', () => {
    expect(
      shouldShowNicknameModalForSpace({
        spaceId: 'space-1',
        spaceNicknames: {},
        isIssuedParticipant: true,
        username: 'ユーザー',
        defaultNickname: 'ユーザー',
        displayName: 'ユーザー',
      }),
    ).toBe(true);
  });

  it('participant + space nickname → hide modal', () => {
    expect(
      shouldShowNicknameModalForSpace({
        spaceId: 'space-1',
        spaceNicknames: { 'space-1': 'にっく' },
        isIssuedParticipant: true,
        username: 'ユーザー',
      }),
    ).toBe(false);
    expect(
      hasNicknameForSpaceGate({
        spaceId: 'space-1',
        spaceNicknames: { 'space-1': 'にっく' },
        isIssuedParticipant: true,
      }),
    ).toBe(true);
  });

  it('regular account keeps username / defaultNickname as registered', () => {
    expect(
      hasNicknameForSpaceGate({
        spaceId: 'space-1',
        spaceNicknames: {},
        isIssuedParticipant: false,
        username: 'ユーザー',
      }),
    ).toBe(true);
    expect(
      hasNicknameForSpaceGate({
        spaceId: 'space-1',
        spaceNicknames: {},
        isIssuedParticipant: false,
        defaultNickname: 'たろう',
      }),
    ).toBe(true);
    expect(
      shouldShowNicknameModalForSpace({
        spaceId: 'space-1',
        spaceNicknames: {},
        isIssuedParticipant: false,
      }),
    ).toBe(true);
  });

  it('hasRegisteredSpaceNickname trims', () => {
    expect(hasRegisteredSpaceNickname({ s: '  a  ' }, 's')).toBe(true);
    expect(hasRegisteredSpaceNickname({ s: '   ' }, 's')).toBe(false);
  });

  it('sanitizeMembershipNicknameCandidate drops placeholder', () => {
    expect(sanitizeMembershipNicknameCandidate('ユーザー')).toBeNull();
    expect(sanitizeMembershipNicknameCandidate(' みー ')).toBe('みー');
    expect(sanitizeMembershipNicknameCandidate('')).toBeNull();
  });
});
