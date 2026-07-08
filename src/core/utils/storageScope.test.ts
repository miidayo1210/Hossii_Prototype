import { describe, expect, it, vi } from 'vitest';
import { scopedStorageKey } from './storageScope';

describe('storageScope', () => {
  it('scopes localStorage keys by expected project ref', () => {
    vi.stubEnv('VITE_EXPECTED_SUPABASE_REF', 'uodaubhlcvvqlgsdxcdf');
    expect(scopedStorageKey('hossii.spaces')).toBe('uodaubhlcvvqlgsdxcdf:hossii.spaces');
    vi.unstubAllEnvs();
  });

  it('falls back to local prefix when ref is unavailable', () => {
    vi.stubEnv('VITE_EXPECTED_SUPABASE_REF', '');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    expect(scopedStorageKey('hossii.profile')).toBe('local:hossii.profile');
    vi.unstubAllEnvs();
  });
});
