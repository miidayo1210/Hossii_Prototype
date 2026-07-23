import { describe, expect, it } from 'vitest';
import { HOSSII_CONNECTION_REASON_EMOJIS } from '../types/hossiiConnection';
import {
  MAX_CONNECTION_REASON_TEXT_LENGTH,
  buildConnectionReasonUpdatePayload,
  normalizeConnectionReasonInput,
} from './connectionReasonValidation';

describe('normalizeConnectionReasonInput', () => {
  it('accepts reasonなし（未指定）', () => {
    expect(normalizeConnectionReasonInput({})).toEqual({
      ok: true,
      value: { reasonText: null, reasonEmoji: null },
    });
  });

  it('空白のみ reasonText を NULL へ正規化', () => {
    expect(normalizeConnectionReasonInput({ reasonText: '   ' })).toEqual({
      ok: true,
      value: { reasonText: null, reasonEmoji: null },
    });
  });

  it('50文字まで許可', () => {
    const text = 'あ'.repeat(50);
    expect(normalizeConnectionReasonInput({ reasonText: text })).toEqual({
      ok: true,
      value: { reasonText: text, reasonEmoji: null },
    });
    expect(text.length).toBe(MAX_CONNECTION_REASON_TEXT_LENGTH);
  });

  it('51文字を拒否', () => {
    const text = 'あ'.repeat(51);
    const res = normalizeConnectionReasonInput({ reasonText: text });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toContain('50');
    }
  });

  it('改行を拒否', () => {
    expect(normalizeConnectionReasonInput({ reasonText: 'hello\nworld' }).ok).toBe(false);
    expect(normalizeConnectionReasonInput({ reasonText: 'hello\r\nworld' }).ok).toBe(false);
  });

  it('8種 emoji を許可', () => {
    for (const emoji of HOSSII_CONNECTION_REASON_EMOJIS) {
      expect(normalizeConnectionReasonInput({ reasonEmoji: emoji })).toEqual({
        ok: true,
        value: { reasonText: null, reasonEmoji: emoji },
      });
    }
  });

  it('未定義 emoji を拒否', () => {
    const res = normalizeConnectionReasonInput({ reasonEmoji: '🚀' as never });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toContain('emoji');
    }
  });

  it('reasonText と reasonEmoji を同時に正規化', () => {
    expect(
      normalizeConnectionReasonInput({
        reasonText: '  つながり  ',
        reasonEmoji: '💡',
      }),
    ).toEqual({
      ok: true,
      value: { reasonText: 'つながり', reasonEmoji: '💡' },
    });
  });
});

describe('buildConnectionReasonUpdatePayload', () => {
  it('text だけ更新 → emoji を payload に含めない', () => {
    expect(buildConnectionReasonUpdatePayload({ reasonText: '更新' })).toEqual({
      ok: true,
      payload: { reason_text: '更新' },
    });
  });

  it('emoji だけ更新 → text を payload に含めない', () => {
    expect(buildConnectionReasonUpdatePayload({ reasonEmoji: '❤️' })).toEqual({
      ok: true,
      payload: { reason_emoji: '❤️' },
    });
  });

  it('text を null → text だけ clear', () => {
    expect(buildConnectionReasonUpdatePayload({ reasonText: null })).toEqual({
      ok: true,
      payload: { reason_text: null },
    });
  });

  it('emoji を null → emoji だけ clear', () => {
    expect(buildConnectionReasonUpdatePayload({ reasonEmoji: null })).toEqual({
      ok: true,
      payload: { reason_emoji: null },
    });
  });

  it('両方 null → 両方 clear', () => {
    expect(
      buildConnectionReasonUpdatePayload({ reasonText: null, reasonEmoji: null }),
    ).toEqual({
      ok: true,
      payload: { reason_text: null, reason_emoji: null },
    });
  });

  it('両方 undefined → 拒否', () => {
    expect(buildConnectionReasonUpdatePayload({})).toEqual({
      ok: false,
      message: 'reasonText or reasonEmoji is required',
    });
  });
});
