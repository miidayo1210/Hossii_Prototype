import { describe, expect, it } from 'vitest';
import {
  clampAdminDescription,
  countChallengeItemStats,
  formatChallengeResponderLabel,
  hasUnsavedProgramEdits,
} from './challengeAdminDisplay';

describe('challengeAdminDisplay', () => {
  it('counts required and optional items', () => {
    expect(
      countChallengeItemStats([
        { isRequired: true },
        { isRequired: true },
        { isRequired: false },
      ]),
    ).toEqual({ total: 3, required: 2, optional: 1 });
  });

  it('clamps long descriptions', () => {
    expect(clampAdminDescription(null)).toBeNull();
    expect(clampAdminDescription('短い説明')).toBe('短い説明');
    expect(clampAdminDescription('あ'.repeat(81))).toBe(`${'あ'.repeat(80)}…`);
  });

  it('formats responder labels with fallback', () => {
    expect(
      formatChallengeResponderLabel('abcdef12-3456-7890', { 'abcdef12-3456-7890': 'みー' }),
    ).toBe('みー');
    expect(formatChallengeResponderLabel('abcdef12-3456-7890', {})).toBe(
      '参加者 abcdef12',
    );
  });

  it('detects unsaved program edits', () => {
    expect(
      hasUnsavedProgramEdits({
        title: 'A',
        description: '',
        savedTitle: 'A',
        savedDescription: null,
      }),
    ).toBe(false);
    expect(
      hasUnsavedProgramEdits({
        title: 'B',
        description: '',
        savedTitle: 'A',
        savedDescription: null,
      }),
    ).toBe(true);
  });
});
