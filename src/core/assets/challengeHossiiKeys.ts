/**
 * Stable Hossii keys for challenge rewards.
 * DB stores these keys; UI resolves to `/hossii/{key}.png`.
 *
 * Dual definition (P5 known drift risk):
 * - Runtime award pool SoT: SQL `public.challenge_reward_hossii_pool()`
 * - UI/path SoT: this TypeScript list
 * Keep both identical; challengeHossiiKeys.test.ts asserts files exist.
 */
export const CHALLENGE_HOSSII_REWARD_KEYS = [
  'emotion/wow',
  'emotion/happy',
  'emotion/heart',
  'emotion/comeup',
  'emotion/humhum',
  'emotion/cryinglaughing',
  'emotion/moved',
  'emotion/fun',
  'emotion/kirakira',
  'emotion/yeah',
  'idle/idle_smile',
  'motion/cheering',
] as const;

export type ChallengeHossiiKey = (typeof CHALLENGE_HOSSII_REWARD_KEYS)[number];

export function isChallengeHossiiKey(value: string): value is ChallengeHossiiKey {
  return (CHALLENGE_HOSSII_REWARD_KEYS as readonly string[]).includes(value);
}

export function getChallengeHossiiImageUrl(hossiiKey: string): string {
  return `/hossii/${hossiiKey}.png`;
}
