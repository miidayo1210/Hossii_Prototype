/**
 * Registered Hossii image keys under public/hossii/.
 * Path rule: /hossii/{key}.png
 *
 * Challenge reward lottery keys remain in challengeHossiiKeys.ts /
 * SQL challenge_reward_hossii_pool() and are intentionally a subset.
 */

/** Costume / themed Hossii — not used in challenge reward lottery. */
export const HOSSII_CUSTOM_KEYS = [
  'custom/angel',
  'custom/cat',
  'custom/devil',
  'custom/fox',
  'custom/honey',
  'custom/king',
  'custom/mermaid',
  'custom/onsen',
  'custom/rabbit',
  'custom/tipsy',
] as const;

/** Location / event extras — not used in challenge reward lottery. */
export const HOSSII_EXTRA_KEYS = [
  'extra/haloween',
  'extra/happybirthday',
  'extra/happynewyear',
  'extra/santa',
  'extra/tanabata',
  'extra/tsukuba_yagi',
] as const;

export type HossiiCustomKey = (typeof HOSSII_CUSTOM_KEYS)[number];
export type HossiiExtraKey = (typeof HOSSII_EXTRA_KEYS)[number];

export function getHossiiAssetUrl(hossiiKey: string): string {
  return `/hossii/${hossiiKey}.png`;
}

export function isHossiiCustomKey(value: string): value is HossiiCustomKey {
  return (HOSSII_CUSTOM_KEYS as readonly string[]).includes(value);
}
