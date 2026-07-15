import { describe, expect, it } from 'vitest';
import { accountSectionToParam, resolveAccountSection } from './accountSection';

describe('resolveAccountSection', () => {
  it('returns home when screenParam is undefined', () => {
    expect(resolveAccountSection(undefined)).toBe('home');
  });

  it('returns home for explicit home param', () => {
    expect(resolveAccountSection('home')).toBe('home');
  });

  it('returns profile for profile param', () => {
    expect(resolveAccountSection('profile')).toBe('profile');
  });

  it('returns spaces for spaces param', () => {
    expect(resolveAccountSection('spaces')).toBe('spaces');
  });

  it('returns my-hossii for my-hossii param', () => {
    expect(resolveAccountSection('my-hossii')).toBe('my-hossii');
  });

  it('falls back to home for unknown params', () => {
    expect(resolveAccountSection('unknown')).toBe('home');
  });
});

describe('accountSectionToParam', () => {
  it('returns undefined for home', () => {
    expect(accountSectionToParam('home')).toBeUndefined();
  });

  it('returns param string for non-home sections', () => {
    expect(accountSectionToParam('profile')).toBe('profile');
    expect(accountSectionToParam('spaces')).toBe('spaces');
    expect(accountSectionToParam('my-hossii')).toBe('my-hossii');
  });
});
