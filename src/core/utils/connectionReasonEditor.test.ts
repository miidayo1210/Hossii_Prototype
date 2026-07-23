import { describe, expect, it } from 'vitest';
import {
  buildCreateReasonFields,
  buildReasonUpdateDelta,
  formatConnectionReasonValidationError,
  seedReasonDraftFromConnection,
} from './connectionReasonEditor';

describe('formatConnectionReasonValidationError', () => {
  it('maps validation messages to Japanese', () => {
    expect(formatConnectionReasonValidationError('reason text must be at most 50 characters')).toBe(
      '理由は50文字以内で入力してください',
    );
    expect(formatConnectionReasonValidationError('reason text must not contain newlines')).toBe(
      '理由に改行は使えません',
    );
    expect(formatConnectionReasonValidationError('invalid connection reason emoji')).toBe(
      '選べない絵文字です',
    );
  });
});

describe('buildCreateReasonFields', () => {
  it('returns empty fields when no reason', () => {
    expect(buildCreateReasonFields('', null)).toEqual({ ok: true, fields: {} });
    expect(buildCreateReasonFields('   ', null)).toEqual({ ok: true, fields: {} });
  });

  it('returns emoji only', () => {
    expect(buildCreateReasonFields('', '💡')).toEqual({
      ok: true,
      fields: { reasonEmoji: '💡' },
    });
  });

  it('returns text only', () => {
    expect(buildCreateReasonFields('  つながり  ', null)).toEqual({
      ok: true,
      fields: { reasonText: 'つながり' },
    });
  });

  it('returns emoji and text', () => {
    expect(buildCreateReasonFields('理由', '🔗')).toEqual({
      ok: true,
      fields: { reasonText: '理由', reasonEmoji: '🔗' },
    });
  });

  it('rejects invalid text', () => {
    const res = buildCreateReasonFields('a'.repeat(51), null);
    expect(res.ok).toBe(false);
  });
});

describe('buildReasonUpdateDelta', () => {
  const original = { reasonText: '既存', reasonEmoji: '💡' as const };

  it('returns null delta when unchanged', () => {
    expect(buildReasonUpdateDelta(original, '既存', '💡')).toEqual({ ok: true, delta: null });
  });

  it('returns text-only delta', () => {
    expect(buildReasonUpdateDelta(original, '更新', '💡')).toEqual({
      ok: true,
      delta: { reasonText: '更新' },
    });
  });

  it('returns emoji-only delta', () => {
    expect(buildReasonUpdateDelta(original, '既存', '❤️')).toEqual({
      ok: true,
      delta: { reasonEmoji: '❤️' },
    });
  });

  it('clears text only', () => {
    expect(buildReasonUpdateDelta(original, '', '💡')).toEqual({
      ok: true,
      delta: { reasonText: null },
    });
  });

  it('clears emoji only', () => {
    expect(buildReasonUpdateDelta(original, '既存', null)).toEqual({
      ok: true,
      delta: { reasonEmoji: null },
    });
  });

  it('clears both', () => {
    expect(buildReasonUpdateDelta(original, '', null)).toEqual({
      ok: true,
      delta: { reasonText: null, reasonEmoji: null },
    });
  });
});

describe('seedReasonDraftFromConnection', () => {
  it('expands when existing reason present', () => {
    expect(
      seedReasonDraftFromConnection({ reasonText: '理由', reasonEmoji: '💡' }),
    ).toEqual({
      draftReasonText: '理由',
      draftReasonEmoji: '💡',
      reasonExpanded: true,
    });
  });

  it('collapses when no reason', () => {
    expect(
      seedReasonDraftFromConnection({ reasonText: null, reasonEmoji: null }),
    ).toEqual({
      draftReasonText: '',
      draftReasonEmoji: null,
      reasonExpanded: false,
    });
  });
});
