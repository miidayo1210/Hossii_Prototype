import { describe, expect, it } from 'vitest';
import {
  buildChallengePublishChecks,
  challengeItemTypeHelp,
  challengeResponseTypeLabel,
  clampAdminDescription,
  countChallengeItemStats,
  evaluateChallengePublishReadiness,
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
        defaultResponseVisibility: 'manager_only',
        savedTitle: 'A',
        savedDescription: null,
        savedDefaultResponseVisibility: 'manager_only',
      }),
    ).toBe(false);
    expect(
      hasUnsavedProgramEdits({
        title: 'B',
        description: '',
        defaultResponseVisibility: 'manager_only',
        savedTitle: 'A',
        savedDescription: null,
        savedDefaultResponseVisibility: 'manager_only',
      }),
    ).toBe(true);
  });

  it('uses form-agnostic item type help and response labels', () => {
    expect(challengeItemTypeHelp('question')).not.toContain('コメント');
    expect(challengeItemTypeHelp('mission')).not.toContain('コメント');
    expect(challengeResponseTypeLabel('photo')).toBe('写真');
  });

  it('builds publish checks aligned with publish gate', () => {
    const empty = buildChallengePublishChecks({
      title: '',
      items: [],
      hasUnsavedProgramEdits: false,
      hasOpenItemForm: false,
    });
    expect(empty.find((item) => item.id === 'title')?.ok).toBe(false);
    expect(empty.find((item) => item.id === 'items')?.ok).toBe(false);
    expect(empty.find((item) => item.id === 'items')?.label).toContain('1件以上');
    expect(evaluateChallengePublishReadiness({
      title: '',
      items: [],
      hasUnsavedProgramEdits: false,
      hasOpenItemForm: false,
    }).canPublish).toBe(false);

    const ready = evaluateChallengePublishReadiness({
      title: '挑戦',
      items: [
        {
          title: 'Q1',
          isRequired: true,
          responseType: 'comment',
          responseConfig: null,
        },
        {
          title: 'Q2',
          isRequired: true,
          responseType: 'choice3',
          responseConfig: { options: ['A', 'B', 'C'] },
        },
        {
          title: 'おまけ',
          isRequired: false,
          responseType: 'photo',
          responseConfig: null,
        },
      ],
      hasUnsavedProgramEdits: false,
      hasOpenItemForm: false,
    });
    expect(ready.canPublish).toBe(true);
    expect(ready.checks.find((item) => item.id === 'items')?.label).toContain('3件');
    expect(ready.checks.find((item) => item.id === 'required')?.label).toContain('2件');
    expect(ready.checks.find((item) => item.id === 'choice3')?.ok).toBe(true);
  });

  it('blocks publish for invalid choice3, unsaved edits, and open item form', () => {
    const invalidChoice = evaluateChallengePublishReadiness({
      title: '挑戦',
      items: [
        {
          title: '気分は？',
          isRequired: true,
          responseType: 'choice3',
          responseConfig: { options: ['A', 'B'] },
        },
      ],
      hasUnsavedProgramEdits: false,
      hasOpenItemForm: false,
    });
    expect(invalidChoice.canPublish).toBe(false);
    expect(invalidChoice.blockReason).toContain('気分は？');

    const unsaved = evaluateChallengePublishReadiness({
      title: '挑戦',
      items: [
        {
          title: 'Q',
          isRequired: true,
          responseType: 'comment',
          responseConfig: null,
        },
      ],
      hasUnsavedProgramEdits: true,
      hasOpenItemForm: false,
    });
    expect(unsaved.canPublish).toBe(false);
    expect(unsaved.blockReason).toContain('下書きを保存');

    const openForm = evaluateChallengePublishReadiness({
      title: '挑戦',
      items: [
        {
          title: 'Q',
          isRequired: true,
          responseType: 'comment',
          responseConfig: null,
        },
      ],
      hasUnsavedProgramEdits: false,
      hasOpenItemForm: true,
    });
    expect(openForm.canPublish).toBe(false);
    expect(openForm.blockReason).toContain('項目の編集中');
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
