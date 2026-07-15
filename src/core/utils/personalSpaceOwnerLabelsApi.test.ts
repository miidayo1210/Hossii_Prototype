import { describe, expect, it } from 'vitest';
import {
  resolvePersonalSpaceOwnerLabel,
  shortOwnerUid,
} from './personalSpaceOwnerLabelsApi';

describe('shortOwnerUid', () => {
  it('先頭8文字と省略記号を返す', () => {
    expect(shortOwnerUid('abcdef12-3456-7890-abcd-ef1234567890')).toBe('abcdef12…');
  });
});

describe('resolvePersonalSpaceOwnerLabel', () => {
  const uid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  it('community_nickname を最優先する', () => {
    expect(
      resolvePersonalSpaceOwnerLabel(uid, {
        communityNickname: 'ほっしー太郎',
        defaultNickname: 'Nick',
        email: 'user@example.com',
      }),
    ).toEqual({
      primary: 'ほっしー太郎',
      secondary: 'user@example.com',
    });
  });

  it('default_nickname を次に使う', () => {
    expect(
      resolvePersonalSpaceOwnerLabel(uid, {
        communityNickname: null,
        defaultNickname: 'Dev User',
        email: 'user@example.com',
      }),
    ).toEqual({
      primary: 'Dev User',
      secondary: 'user@example.com',
    });
  });

  it('メールのローカル部をフォールバックに使う', () => {
    expect(
      resolvePersonalSpaceOwnerLabel(uid, {
        communityNickname: null,
        defaultNickname: null,
        email: 'dev-user-a@example.test',
      }),
    ).toEqual({
      primary: 'dev-user-a',
      secondary: 'dev-user-a@example.test',
    });
  });

  it('lookup が無いときは UID 短縮を使う', () => {
    expect(resolvePersonalSpaceOwnerLabel(uid, undefined)).toEqual({
      primary: 'aaaaaaaa…',
      secondary: null,
    });
  });

  it('ownerUserId が無いときは不明', () => {
    expect(resolvePersonalSpaceOwnerLabel(undefined, undefined)).toEqual({
      primary: '不明',
      secondary: null,
    });
  });
});
