import { describe, expect, it } from 'vitest';
import {
  extractProjectRefFromSupabaseUrl,
  getProjectRefSuffix,
  parseAppEnvironment,
  validateSupabaseEnvironment,
} from './supabaseEnvironment';

describe('supabaseEnvironment', () => {
  it('parses known app environments', () => {
    expect(parseAppEnvironment('development')).toBe('development');
    expect(parseAppEnvironment('production')).toBe('production');
    expect(parseAppEnvironment('staging')).toBeNull();
  });

  it('extracts project ref from Supabase URL', () => {
    expect(
      extractProjectRefFromSupabaseUrl('https://uodaubhlcvvqlgsdxcdf.supabase.co'),
    ).toBe('uodaubhlcvvqlgsdxcdf');
    expect(extractProjectRefFromSupabaseUrl('not-a-url')).toBeNull();
  });

  it('allows mock mode when Supabase is not configured', () => {
    const result = validateSupabaseEnvironment({
      appEnv: null,
      expectedProjectRef: null,
      supabaseUrl: null,
      supabaseAnonKey: null,
    });

    expect(result.isConfigured).toBe(false);
    expect(result.isValid).toBe(true);
    expect(result.shouldBlockApp).toBe(false);
  });

  it('blocks when expected ref mismatches actual ref', () => {
    const result = validateSupabaseEnvironment({
      appEnv: 'production',
      expectedProjectRef: 'wzyoddyvfjkagqpnjejo',
      supabaseUrl: 'https://uodaubhlcvvqlgsdxcdf.supabase.co',
      supabaseAnonKey: 'anon-key',
    });

    expect(result.isValid).toBe(false);
    expect(result.shouldBlockApp).toBe(true);
    expect(result.errorMessage).toContain('expected=wzyoddyvfjkagqpnjejo');
    expect(result.errorMessage).toContain('actual=uodaubhlcvvqlgsdxcdf');
  });

  it('shows dev banner only in development with matching ref', () => {
    const result = validateSupabaseEnvironment({
      appEnv: 'development',
      expectedProjectRef: 'uodaubhlcvvqlgsdxcdf',
      supabaseUrl: 'https://uodaubhlcvvqlgsdxcdf.supabase.co',
      supabaseAnonKey: 'anon-key',
    });

    expect(result.isValid).toBe(true);
    expect(result.shouldShowDevBanner).toBe(true);
    expect(result.shouldBlockApp).toBe(false);
  });

  it('hides dev banner in production', () => {
    const result = validateSupabaseEnvironment({
      appEnv: 'production',
      expectedProjectRef: 'wzyoddyvfjkagqpnjejo',
      supabaseUrl: 'https://wzyoddyvfjkagqpnjejo.supabase.co',
      supabaseAnonKey: 'anon-key',
    });

    expect(result.shouldShowDevBanner).toBe(false);
  });

  it('returns project ref suffix for developer hint', () => {
    expect(getProjectRefSuffix('uodaubhlcvvqlgsdxcdf')).toBe('xcdf');
  });
});
