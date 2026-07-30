import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_HOSSII_REWARD_KEYS,
  getChallengeHossiiImageUrl,
} from './challengeHossiiKeys';

const PUBLIC_ROOT = resolve(import.meta.dirname, '../../../public');

describe('challenge Hossii reward keys', () => {
  it('has a real PNG for every pool key under public/hossii', () => {
    for (const key of CHALLENGE_HOSSII_REWARD_KEYS) {
      const absolute = resolve(PUBLIC_ROOT, 'hossii', `${key}.png`);
      expect(existsSync(absolute), absolute).toBe(true);
      expect(getChallengeHossiiImageUrl(key)).toBe(`/hossii/${key}.png`);
    }
  });

  it('does not include uppercase or wrong extensions in keys', () => {
    for (const key of CHALLENGE_HOSSII_REWARD_KEYS) {
      expect(key).toBe(key.toLowerCase());
      expect(key.includes('.png')).toBe(false);
      expect(key.startsWith('/')).toBe(false);
    }
  });
});
