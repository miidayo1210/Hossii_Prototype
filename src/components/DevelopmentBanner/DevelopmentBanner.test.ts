import { describe, expect, it } from 'vitest';
import { validateSupabaseEnvironment } from '../../core/supabaseEnvironment';

describe('DevelopmentBanner visibility', () => {
  it('is shown only when app env is development and config is valid', () => {
    const visible = validateSupabaseEnvironment({
      appEnv: 'development',
      expectedProjectRef: 'uodaubhlcvvqlgsdxcdf',
      supabaseUrl: 'https://uodaubhlcvvqlgsdxcdf.supabase.co',
      supabaseAnonKey: 'anon-key',
    });

    const hidden = validateSupabaseEnvironment({
      appEnv: 'production',
      expectedProjectRef: 'wzyoddyvfjkagqpnjejo',
      supabaseUrl: 'https://wzyoddyvfjkagqpnjejo.supabase.co',
      supabaseAnonKey: 'anon-key',
    });

    expect(visible.shouldShowDevBanner).toBe(true);
    expect(hidden.shouldShowDevBanner).toBe(false);
  });
});
