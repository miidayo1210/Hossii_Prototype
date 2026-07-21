import { describe, expect, it } from 'vitest';
import type { Space } from '../types/space';
import { canEnterSpaceAsGuest } from './guestParticipation';

const baseSpace: Space = {
  id: 'space-1',
  name: 'Test',
  quickEmotions: ['joy'],
  createdAt: new Date(),
  isPrivate: false,
};

describe('canEnterSpaceAsGuest', () => {
  it('allows guest_only and guest_and_account', () => {
    expect(canEnterSpaceAsGuest({ ...baseSpace, participationMode: 'guest_only' })).toBe(true);
    expect(canEnterSpaceAsGuest({ ...baseSpace, participationMode: 'guest_and_account' })).toBe(
      true,
    );
  });

  it('denies account_only', () => {
    expect(canEnterSpaceAsGuest({ ...baseSpace, participationMode: 'account_only' })).toBe(false);
  });

  it('treats undefined participationMode as guest_and_account (allowed)', () => {
    expect(canEnterSpaceAsGuest({ ...baseSpace })).toBe(true);
  });

  it('treats invalid participationMode as guest_and_account (allowed)', () => {
    expect(canEnterSpaceAsGuest({ ...baseSpace, participationMode: 'invalid' as never })).toBe(
      true,
    );
  });

  it('denies undefined space and private spaces', () => {
    expect(canEnterSpaceAsGuest(undefined)).toBe(false);
    expect(canEnterSpaceAsGuest({ ...baseSpace, isPrivate: true })).toBe(false);
  });
});
