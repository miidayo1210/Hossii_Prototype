import { describe, expect, it } from 'vitest';
import {
  formatOwnerDisplayName,
  resolvePersonalSpaceOwnerDisplay,
} from './personalSpaceOwnerLabelsApi';

describe('formatOwnerDisplayName', () => {
  it('「さん」を付与する', () => {
    expect(formatOwnerDisplayName('田中')).toBe('田中さん');
  });

  it('既に「さん」が付いていればそのまま', () => {
    expect(formatOwnerDisplayName('田中さん')).toBe('田中さん');
  });

  it('名前未設定はそのまま', () => {
    expect(formatOwnerDisplayName('名前未設定')).toBe('名前未設定');
  });
});

describe('resolvePersonalSpaceOwnerDisplay', () => {
  it('community_nickname を最優先する', () => {
    expect(
      resolvePersonalSpaceOwnerDisplay({
        communityNickname: 'ほっしー太郎',
        profileNickname: 'Nick',
        participantDisplayName: 'login1',
        adminEmail: 'user@example.com',
      }),
    ).toEqual({
      displayName: 'ほっしー太郎さん',
      supplementaryEmail: 'user@example.com',
    });
  });

  it('profile nickname を次に使う', () => {
    expect(
      resolvePersonalSpaceOwnerDisplay({
        communityNickname: null,
        profileNickname: 'Dev User',
        participantDisplayName: 'login1',
        adminEmail: null,
      }),
    ).toEqual({
      displayName: 'Dev Userさん',
      supplementaryEmail: null,
    });
  });

  it('participant display を次に使う', () => {
    expect(
      resolvePersonalSpaceOwnerDisplay({
        communityNickname: null,
        profileNickname: null,
        participantDisplayName: 'frog-01',
        adminEmail: null,
      }),
    ).toEqual({
      displayName: 'frog-01さん',
      supplementaryEmail: null,
    });
  });

  it('lookup が無いときは名前未設定', () => {
    expect(resolvePersonalSpaceOwnerDisplay(undefined)).toEqual({
      displayName: '名前未設定',
      supplementaryEmail: null,
    });
  });
});
