import { describe, expect, it } from 'vitest';
import { validateSupabaseEnvironment } from '../../core/supabaseEnvironment';
import {
  DEVELOPMENT_BANNER_POINTER_EVENTS,
  DEVELOPMENT_BANNER_PORTAL_TARGET,
  DEVELOPMENT_BANNER_Z_INDEX,
  shouldRenderDevelopmentBanner,
} from './developmentBannerLayer';

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

    expect(shouldRenderDevelopmentBanner(visible)).toBe(true);
    expect(shouldRenderDevelopmentBanner(hidden)).toBe(false);
  });

  it('uses body portal so admin, space, and login routes share the same banner host', () => {
    expect(DEVELOPMENT_BANNER_PORTAL_TARGET).toBe('document.body');
  });

  it('stacks above space screen UI but below modal layers', () => {
    expect(DEVELOPMENT_BANNER_Z_INDEX).toBeGreaterThan(600);
    expect(DEVELOPMENT_BANNER_Z_INDEX).toBeLessThan(998);
  });

  it('does not block clicks on underlying UI', () => {
    expect(DEVELOPMENT_BANNER_POINTER_EVENTS).toBe('none');
  });
});
