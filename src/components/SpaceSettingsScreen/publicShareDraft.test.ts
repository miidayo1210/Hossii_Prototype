import { describe, expect, it } from 'vitest';
import type { Space } from '../../core/types/space';
import {
  buildPublicShareDraft,
  buildPublicShareDbPatch,
  buildPublicShareStorePatch,
  isParticipationModeDirty,
  shouldShowParticipationModeSection,
} from './publicShareDraft';

const baseSpace: Space = {
  id: 'space-1',
  name: 'Test Space',
  quickEmotions: ['joy'],
  createdAt: new Date(),
  spaceType: 'shared',
  isPrivate: false,
  accessMode: 'public',
};

describe('buildPublicShareDraft', () => {
  it('normalizes undefined participationMode to guest_and_account', () => {
    expect(buildPublicShareDraft(baseSpace).participationMode).toBe('guest_and_account');
  });

  it('preserves valid participation modes', () => {
    expect(
      buildPublicShareDraft({ ...baseSpace, participationMode: 'guest_only' }).participationMode,
    ).toBe('guest_only');
    expect(
      buildPublicShareDraft({ ...baseSpace, participationMode: 'guest_and_account' }).participationMode,
    ).toBe('guest_and_account');
    expect(
      buildPublicShareDraft({ ...baseSpace, participationMode: 'account_only' }).participationMode,
    ).toBe('account_only');
  });
});

describe('shouldShowParticipationModeSection', () => {
  it('shows for shared spaces', () => {
    expect(shouldShowParticipationModeSection(baseSpace)).toBe(true);
  });

  it('hides for personal spaces', () => {
    expect(shouldShowParticipationModeSection({ ...baseSpace, spaceType: 'personal' })).toBe(false);
  });
});

describe('save payloads', () => {
  const draft = buildPublicShareDraft({
    ...baseSpace,
    participationMode: 'account_only',
  });

  it('includes participationMode in store patch for shared spaces', () => {
    expect(buildPublicShareStorePatch(draft, baseSpace).participationMode).toBe('account_only');
  });

  it('omits participationMode from store patch for personal spaces', () => {
    const personalSpace = { ...baseSpace, spaceType: 'personal' as const };
    expect(buildPublicShareStorePatch(draft, personalSpace).participationMode).toBeUndefined();
  });

  it('sends participationMode to DB only when changed', () => {
    expect(buildPublicShareDbPatch(draft, baseSpace).participationMode).toBe('account_only');
    expect(
      buildPublicShareDbPatch(
        { ...draft, participationMode: 'guest_and_account' },
        { ...baseSpace, participationMode: 'guest_and_account' },
      ).participationMode,
    ).toBeUndefined();
  });

  it('treats undefined and guest_and_account as unchanged for DB patch', () => {
    const draftDefault = buildPublicShareDraft({ ...baseSpace, participationMode: undefined });
    expect(buildPublicShareDbPatch(draftDefault, baseSpace).participationMode).toBeUndefined();
  });

  it('omits participationMode from DB patch for personal spaces', () => {
    const personalSpace = { ...baseSpace, spaceType: 'personal' as const, participationMode: undefined };
    expect(buildPublicShareDbPatch(draft, personalSpace).participationMode).toBeUndefined();
  });

  it('detects participation mode dirty state', () => {
    expect(isParticipationModeDirty(draft, baseSpace)).toBe(true);
    expect(
      isParticipationModeDirty(
        { ...draft, participationMode: 'guest_and_account' },
        { ...baseSpace, participationMode: 'guest_and_account' },
      ),
    ).toBe(false);
  });
});
