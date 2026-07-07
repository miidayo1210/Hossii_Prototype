import type { MyHossiiAnimationTier } from '../types/myHossii';

/** 1〜5体: full / 6〜12体: light / 13体以上: none */
export function resolveMyHossiiAnimationTier(participantCount: number): MyHossiiAnimationTier {
  if (participantCount <= 5) return 'full';
  if (participantCount <= 12) return 'light';
  return 'none';
}
