import { describe, expect, it } from 'vitest';
import {
  formatConnectionReasonDisplay,
  hasConnectionReasonDisplay,
} from './formatConnectionReasonDisplay';

describe('formatConnectionReasonDisplay', () => {
  it('returns null when reason is absent', () => {
    expect(formatConnectionReasonDisplay(null, null)).toBeNull();
    expect(formatConnectionReasonDisplay(undefined, undefined)).toBeNull();
    expect(hasConnectionReasonDisplay(null, null)).toBe(false);
  });

  it('returns null for blank text only', () => {
    expect(formatConnectionReasonDisplay('   ', null)).toBeNull();
    expect(hasConnectionReasonDisplay('   ', null)).toBe(false);
  });

  it('returns emoji only', () => {
    expect(formatConnectionReasonDisplay(null, '💡')).toBe('💡');
    expect(hasConnectionReasonDisplay(null, '💡')).toBe(true);
  });

  it('returns text only', () => {
    expect(formatConnectionReasonDisplay('テーマが近い', null)).toBe('テーマが近い');
    expect(hasConnectionReasonDisplay('テーマが近い', null)).toBe(true);
  });

  it('returns emoji and text', () => {
    expect(formatConnectionReasonDisplay('テーマが近い', '💡')).toBe('💡 テーマが近い');
  });

  it('preserves XSS-like strings as plain text', () => {
    const xss = '<img onerror=alert(1)>';
    expect(formatConnectionReasonDisplay(xss, null)).toBe(xss);
  });
});
