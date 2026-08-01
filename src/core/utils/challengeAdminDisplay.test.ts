import { describe, expect, it } from 'vitest';
import {
  buildChallengePublishChecks,
  clampAdminDescription,
  countChallengeItemStats,
  formatChallengeResponderLabel,
  hasUnsavedProgramEdits,
  itemFormHasContent,
  validateChallengeItemForm,
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

  it('builds publish checks aligned with publish gate', () => {
    const empty = buildChallengePublishChecks({
      title: '',
      itemTotal: 0,
      requiredTotal: 0,
    });
    expect(empty.map((item) => item.ok)).toEqual([false, false, true]);
    expect(empty[1].label).toContain('1件以上');

    const ready = buildChallengePublishChecks({
      title: '挑戦',
      itemTotal: 3,
      requiredTotal: 2,
    });
    expect(ready.every((item) => item.ok)).toBe(true);
    expect(ready[1].label).toContain('3件');
    expect(ready[2].label).toContain('2件');
  });

  it('validates item form fields', () => {
    expect(
      validateChallengeItemForm({ title: '', description: '', reason: '' }),
    ).toContain('問い・ミッション');
    expect(
      validateChallengeItemForm({
        title: 'ok',
        description: '',
        reason: '',
      }),
    ).toBeNull();
    expect(
      itemFormHasContent({ title: '', description: 'x', reason: '' }),
    ).toBe(true);
  });
});
