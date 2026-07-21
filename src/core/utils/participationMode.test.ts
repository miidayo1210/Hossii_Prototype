import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARTICIPATION_MODE,
  normalizeParticipationMode,
} from './participationMode';

describe('normalizeParticipationMode', () => {
  it('maps the three valid values', () => {
    expect(normalizeParticipationMode('guest_only')).toBe('guest_only');
    expect(normalizeParticipationMode('guest_and_account')).toBe('guest_and_account');
    expect(normalizeParticipationMode('account_only')).toBe('account_only');
  });

  it('falls back to default for undefined, null, and empty string', () => {
    expect(normalizeParticipationMode(undefined)).toBe(DEFAULT_PARTICIPATION_MODE);
    expect(normalizeParticipationMode(null)).toBe(DEFAULT_PARTICIPATION_MODE);
    expect(normalizeParticipationMode('')).toBe(DEFAULT_PARTICIPATION_MODE);
  });

  it('falls back to default for unknown values', () => {
    expect(normalizeParticipationMode('both')).toBe(DEFAULT_PARTICIPATION_MODE);
    expect(normalizeParticipationMode('GUEST_ONLY')).toBe(DEFAULT_PARTICIPATION_MODE);
    expect(normalizeParticipationMode(42)).toBe(DEFAULT_PARTICIPATION_MODE);
  });

  it('treats whitespace-padded values as invalid (exact match only)', () => {
    expect(normalizeParticipationMode(' guest_only')).toBe(DEFAULT_PARTICIPATION_MODE);
    expect(normalizeParticipationMode('guest_only ')).toBe(DEFAULT_PARTICIPATION_MODE);
    expect(normalizeParticipationMode(' guest_only ')).toBe(DEFAULT_PARTICIPATION_MODE);
    expect(normalizeParticipationMode('   ')).toBe(DEFAULT_PARTICIPATION_MODE);
  });
});
