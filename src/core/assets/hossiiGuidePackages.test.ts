import { describe, expect, it } from 'vitest';
import {
  HOSSII_GUIDE_PACKAGES,
  isKnownHossiiGuidePackageKey,
  listHossiiGuidePackages,
  resolvePackageMessages,
} from './hossiiGuidePackages';

describe('hossiiGuidePackages', () => {
  it('defines 8 packages each with at least 5 messages', () => {
    expect(HOSSII_GUIDE_PACKAGES).toHaveLength(8);
    for (const pkg of HOSSII_GUIDE_PACKAGES) {
      expect(pkg.label.length).toBeGreaterThan(0);
      expect(pkg.messages.length).toBeGreaterThanOrEqual(5);
      for (const message of pkg.messages) {
        expect(message.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('has unique package keys', () => {
    const keys = HOSSII_GUIDE_PACKAGES.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('resolvePackageMessages returns messages for known keys', () => {
    const messages = resolvePackageMessages('reflection');
    expect(messages.length).toBeGreaterThanOrEqual(5);
    expect(messages[0]).toBe('今日、印象に残ったことは？');
  });

  it('resolvePackageMessages returns empty for unknown keys', () => {
    expect(resolvePackageMessages('unknown')).toEqual([]);
    expect(resolvePackageMessages(undefined)).toEqual([]);
    expect(resolvePackageMessages(null)).toEqual([]);
  });

  it('isKnownHossiiGuidePackageKey validates keys', () => {
    expect(isKnownHossiiGuidePackageKey('ideas')).toBe(true);
    expect(isKnownHossiiGuidePackageKey('invalid')).toBe(false);
  });

  it('listHossiiGuidePackages returns all packages', () => {
    expect(listHossiiGuidePackages()).toHaveLength(8);
  });
});
