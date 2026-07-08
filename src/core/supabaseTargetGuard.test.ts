import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  getEnvironmentByName,
  isDevelopmentRef,
  isProductionRef,
  PRODUCTION_CONFIRM_VALUE,
} from '../../scripts/lib/supabase-target.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('supabase target guard', () => {
  it('loads production and development refs from config', () => {
    expect(getEnvironmentByName('production').projectRef).toBe('wzyoddyvfjkagqpnjejo');
    expect(getEnvironmentByName('development').projectRef).toBe('uodaubhlcvvqlgsdxcdf');
  });

  it('detects production ref', () => {
    expect(isProductionRef('wzyoddyvfjkagqpnjejo')).toBe(true);
    expect(isProductionRef('uodaubhlcvvqlgsdxcdf')).toBe(false);
  });

  it('detects development ref', () => {
    expect(isDevelopmentRef('uodaubhlcvvqlgsdxcdf')).toBe(true);
    expect(isDevelopmentRef('wzyoddyvfjkagqpnjejo')).toBe(false);
  });

  it('requires explicit production confirmation value', () => {
    expect(PRODUCTION_CONFIRM_VALUE).toBe('wzyoddyvfjkagqpnjejo');
  });

  it('rejects production seed script when linked to production', () => {
    const seedScript = readFileSync(join(repoRoot, 'scripts', 'seed-development.mjs'), 'utf8');
    expect(seedScript).toContain("assertLinkedTarget('development')");
    expect(seedScript).not.toContain("assertLinkedTarget('production')");
  });

  it('requires production confirmation in prod push script', () => {
    const prodScript = readFileSync(join(repoRoot, 'scripts', 'push-production-migrations.mjs'), 'utf8');
    expect(prodScript).toContain('CONFIRM_PRODUCTION');
    expect(prodScript).toContain('PRODUCTION_CONFIRM_VALUE');
  });
});
