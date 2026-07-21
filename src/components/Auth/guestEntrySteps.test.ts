import { describe, expect, it } from 'vitest';
import type { ParticipationMode } from '../../core/types/space';
import {
  getAccountCardDescription,
  getSelectPrompt,
  resolveDisplayStep,
  resolveInitialStep,
  resolveStepAfterModeChange,
  shouldShowAccountCard,
  shouldShowGuestCard,
  shouldShowRevisit,
} from './guestEntrySteps';

const spaceId = 'dev-space-public';
const nicknames = { [spaceId]: 'テスト太郎' };
const emptyNicknames = {};

describe('resolveInitialStep', () => {
  it.each<[ParticipationMode, typeof nicknames | typeof emptyNicknames, 'select' | 'revisit']>([
    ['guest_only', emptyNicknames, 'select'],
    ['guest_only', nicknames, 'revisit'],
    ['guest_and_account', emptyNicknames, 'select'],
    ['guest_and_account', nicknames, 'revisit'],
    ['account_only', emptyNicknames, 'select'],
    ['account_only', nicknames, 'select'],
  ])('%s + nicknames=%j → %s', (mode, stored, expected) => {
    expect(resolveInitialStep(stored, spaceId, mode)).toBe(expected);
  });
});

describe('select card visibility', () => {
  it('guest_only shows guest only', () => {
    expect(shouldShowGuestCard('guest_only')).toBe(true);
    expect(shouldShowAccountCard('guest_only')).toBe(false);
  });

  it('guest_and_account shows both', () => {
    expect(shouldShowGuestCard('guest_and_account')).toBe(true);
    expect(shouldShowAccountCard('guest_and_account')).toBe(true);
  });

  it('account_only shows account only', () => {
    expect(shouldShowGuestCard('account_only')).toBe(false);
    expect(shouldShowAccountCard('account_only')).toBe(true);
  });
});

describe('account_only defenses', () => {
  it('never shows revisit even with saved nickname', () => {
    expect(shouldShowRevisit('account_only', 'テスト太郎')).toBe(false);
    expect(resolveDisplayStep('revisit', 'account_only', 'テスト太郎')).toBe('select');
  });

  it('falls back nickname step to select', () => {
    expect(resolveDisplayStep('nickname', 'account_only', 'テスト太郎')).toBe('select');
  });

  it('uses participant ID copy on account card', () => {
    expect(getAccountCardDescription('account_only')).toBe(
      '案内された参加IDとパスワードを入力します',
    );
    expect(getAccountCardDescription('guest_and_account')).toBe('参加した情報を引き継げます');
  });
});

describe('select prompt copy', () => {
  it('varies by participation mode', () => {
    expect(getSelectPrompt('guest_and_account')).toBe('どの方法で参加する？');
    expect(getSelectPrompt('guest_only')).toBe('ゲストとして参加してね');
    expect(getSelectPrompt('account_only')).toBe('参加IDで参加してね');
  });
});

describe('resolveStepAfterModeChange', () => {
  it('account_only clears revisit and nickname', () => {
    expect(resolveStepAfterModeChange('revisit', nicknames, spaceId, 'account_only')).toBe('select');
    expect(resolveStepAfterModeChange('nickname', nicknames, spaceId, 'account_only')).toBe('select');
    expect(resolveStepAfterModeChange('select', nicknames, spaceId, 'account_only')).toBe('select');
  });

  it('switching to guest mode with saved nickname shows revisit', () => {
    expect(
      resolveStepAfterModeChange('select', nicknames, spaceId, 'guest_and_account'),
    ).toBe('revisit');
  });

  it('keeps nickname step when already entering guest nickname', () => {
    expect(resolveStepAfterModeChange('nickname', emptyNicknames, spaceId, 'guest_only')).toBe(
      'nickname',
    );
  });
});
