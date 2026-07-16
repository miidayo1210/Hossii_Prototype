import { describe, expect, it } from 'vitest';
import {
  buildGuideMessagePool,
  formatGuideMessageText,
  hasInvalidStoredPackageKey,
  normalizeHossiiGuideSettings,
  pickRandomGuideMessage,
  resolveGuideDisplayMessage,
  validateHossiiGuideSettingsForSave,
} from './hossiiGuide';
import type { HossiiGuideSettings } from '../types/settings';

describe('hossiiGuide utils', () => {
  describe('normalizeHossiiGuideSettings', () => {
    it('returns undefined for invalid input', () => {
      expect(normalizeHossiiGuideSettings(null)).toBeUndefined();
      expect(normalizeHossiiGuideSettings('x')).toBeUndefined();
    });

    it('parses enabled and packageKey', () => {
      expect(
        normalizeHossiiGuideSettings({ enabled: true, mode: 'package', packageKey: 'ideas' }),
      ).toEqual({ enabled: true, mode: 'package', packageKey: 'ideas' });
    });
  });

  describe('buildGuideMessagePool', () => {
    it('returns empty when disabled', () => {
      expect(buildGuideMessagePool({ enabled: false, mode: 'package', packageKey: 'ideas' })).toEqual([]);
    });

    it('returns empty for unknown packageKey', () => {
      expect(buildGuideMessagePool({ enabled: true, mode: 'package', packageKey: 'bad' })).toEqual([]);
    });

    it('returns package messages when enabled', () => {
      const pool = buildGuideMessagePool({ enabled: true, mode: 'package', packageKey: 'reflection' });
      expect(pool.length).toBeGreaterThanOrEqual(5);
    });

    it('ignores customMessages in Phase 1', () => {
      const pool = buildGuideMessagePool({
        enabled: true,
        mode: 'package',
        packageKey: 'reflection',
        customMessages: ['手動メッセージ'],
      });
      expect(pool).not.toContain('手動メッセージ');
    });

    it('returns empty for custom mode', () => {
      expect(
        buildGuideMessagePool({ enabled: true, mode: 'custom', customMessages: ['a'] }),
      ).toEqual([]);
    });
  });

  describe('pickRandomGuideMessage', () => {
    it('returns null for empty pool', () => {
      expect(pickRandomGuideMessage([])).toBeNull();
    });

    it('returns the only message when pool has one item', () => {
      expect(pickRandomGuideMessage(['唯一の言葉'], () => 0.9)).toBe('唯一の言葉');
    });

    it('picks from pool using random', () => {
      const pool = ['a', 'b', 'c'];
      expect(pickRandomGuideMessage(pool, () => 0)).toBe('a');
      expect(pickRandomGuideMessage(pool, () => 0.99)).toBe('c');
    });
  });

  describe('formatGuideMessageText', () => {
    it('trims and removes newlines', () => {
      expect(formatGuideMessageText('  hello\nworld  ')).toBe('hello world');
    });

    it('truncates long text', () => {
      const long = 'あ'.repeat(150);
      expect(formatGuideMessageText(long, 10)).toBe(`${'あ'.repeat(9)}…`);
    });
  });

  describe('resolveGuideDisplayMessage', () => {
    it('returns null when disabled', () => {
      expect(resolveGuideDisplayMessage({ enabled: false, mode: 'package' })).toBeNull();
    });

    it('returns a message when enabled with valid package', () => {
      const msg = resolveGuideDisplayMessage(
        { enabled: true, mode: 'package', packageKey: 'gratitude' },
        () => 0,
      );
      expect(msg).toBeTruthy();
    });
  });

  describe('validateHossiiGuideSettingsForSave', () => {
    it('allows save when disabled without packageKey', () => {
      const result = validateHossiiGuideSettingsForSave({ enabled: false, mode: 'package' });
      expect(result.ok).toBe(true);
    });

    it('rejects enabled without packageKey', () => {
      const result = validateHossiiGuideSettingsForSave({ enabled: true, mode: 'package' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain('セット');
      }
    });

    it('rejects invalid packageKey', () => {
      const result = validateHossiiGuideSettingsForSave({
        enabled: true,
        mode: 'package',
        packageKey: 'unknown',
      });
      expect(result.ok).toBe(false);
    });

    it('accepts valid enabled settings', () => {
      const result = validateHossiiGuideSettingsForSave({
        enabled: true,
        mode: 'package',
        packageKey: 'dialogue',
      });
      expect(result).toEqual({
        ok: true,
        settings: { enabled: true, mode: 'package', packageKey: 'dialogue' },
      });
    });
  });

  describe('hasInvalidStoredPackageKey', () => {
    it('detects unknown keys when enabled', () => {
      expect(
        hasInvalidStoredPackageKey({ enabled: true, mode: 'package', packageKey: 'nope' }),
      ).toBe(true);
    });

    it('returns false when disabled', () => {
      expect(
        hasInvalidStoredPackageKey({ enabled: false, mode: 'package', packageKey: 'nope' } as HossiiGuideSettings),
      ).toBe(false);
    });
  });
});
