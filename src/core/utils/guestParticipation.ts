import type { Space } from '../types/space';
import { normalizeParticipationMode } from './participationMode';

/**
 * 未ログインのゲストとして SpaceScreen へ入室できるか。
 * account_only / isPrivate / space 未発見時は false。
 */
export function canEnterSpaceAsGuest(space: Space | undefined): space is Space {
  if (!space) return false;
  if (space.isPrivate) return false;
  return normalizeParticipationMode(space.participationMode) !== 'account_only';
}
