// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hasSeenMySpaceTabHint, markMySpaceTabHintSeen } from './mySpaceTabHint';

describe('mySpaceTabHint', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts unseen', () => {
    expect(hasSeenMySpaceTabHint()).toBe(false);
  });

  it('markMySpaceTabHintSeen persists seen state', () => {
    markMySpaceTabHintSeen();
    expect(hasSeenMySpaceTabHint()).toBe(true);
  });
});
