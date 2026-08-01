import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHALLENGE_HOSSII_REWARD_KEYS } from './challengeHossiiKeys';
import {
  HOSSII_CUSTOM_KEYS,
  HOSSII_EXTRA_KEYS,
  getHossiiAssetUrl,
} from './hossiiRegisteredAssets';

const PUBLIC_ROOT = resolve(import.meta.dirname, '../../../public');

function expectPng(key: string) {
  const absolute = resolve(PUBLIC_ROOT, 'hossii', `${key}.png`);
  expect(existsSync(absolute), absolute).toBe(true);
  expect(getHossiiAssetUrl(key)).toBe(`/hossii/${key}.png`);
}

describe('registered Hossii assets', () => {
  it('has PNGs for every custom costume key', () => {
    for (const key of HOSSII_CUSTOM_KEYS) {
      expect(key).toBe(key.toLowerCase());
      expectPng(key);
    }
  });

  it('has PNGs for every extra key including tsukuba_yagi', () => {
    for (const key of HOSSII_EXTRA_KEYS) {
      expect(key).toBe(key.toLowerCase());
      expectPng(key);
    }
  });

  it('keeps custom/extra keys out of the challenge reward pool', () => {
    const pool = new Set<string>(CHALLENGE_HOSSII_REWARD_KEYS);
    for (const key of HOSSII_CUSTOM_KEYS) {
      expect(pool.has(key)).toBe(false);
    }
    expect(pool.has('extra/tsukuba_yagi')).toBe(false);
  });

  it('does not register duplicate keys across custom and extra', () => {
    const all = [...HOSSII_CUSTOM_KEYS, ...HOSSII_EXTRA_KEYS];
    expect(new Set(all).size).toBe(all.length);
  });
});
