import { describe, expect, it } from 'vitest';
import {
  challengeResponseVisibilityParticipantExplanation,
  resolveChallengeResponseVisibility,
} from './challengeVisibility';

describe('participant visibility explanation', () => {
  it('explains resolved settings without a chooser', () => {
    expect(
      challengeResponseVisibilityParticipantExplanation('space_members'),
    ).toContain('みんなへ共有');
    expect(
      challengeResponseVisibilityParticipantExplanation('manager_only'),
    ).toContain('スペース管理者');
    expect(
      challengeResponseVisibilityParticipantExplanation('self_only'),
    ).toContain('あなただけ');
  });

  it('resolves item override for the explanation source', () => {
    expect(
      resolveChallengeResponseVisibility({
        itemResponseVisibility: 'space_members',
        programDefaultResponseVisibility: 'manager_only',
      }),
    ).toBe('space_members');
  });
});
