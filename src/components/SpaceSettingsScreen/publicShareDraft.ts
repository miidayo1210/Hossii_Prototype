import type { ParticipationMode, Space, SpaceUpdatePatch } from '../../core/types/space';
import { normalizeParticipationMode } from '../../core/utils/participationMode';

export type PublicShareDraft = {
  isPrivate: boolean;
  accessMode: 'public' | 'invite_only';
  spaceURLInput: string;
  participationMode: ParticipationMode;
};

export const PARTICIPATION_MODE_OPTIONS: ReadonlyArray<{
  value: ParticipationMode;
  title: string;
  description: string;
}> = [
  {
    value: 'guest_only',
    title: 'ゲストのみ',
    description: 'ニックネームだけで参加できます',
  },
  {
    value: 'guest_and_account',
    title: 'ゲストとアカウント',
    description: '参加方法を選べます',
  },
  {
    value: 'account_only',
    title: 'アカウントのみ',
    description: '案内された参加IDとパスワードが必要です',
  },
];

export function buildPublicShareDraft(space: Space): PublicShareDraft {
  return {
    isPrivate: space.isPrivate ?? false,
    accessMode: space.accessMode ?? 'public',
    spaceURLInput: space.spaceURL ?? '',
    participationMode: normalizeParticipationMode(space.participationMode),
  };
}

/** shared スペースのみ参加方法 UI を表示（personal では非表示）。 */
export function shouldShowParticipationModeSection(space: Space): boolean {
  return space.spaceType !== 'personal';
}

export function buildPublicShareStorePatch(
  draft: PublicShareDraft,
  space: Space,
): Partial<Space> {
  const patch: Partial<Space> = {
    isPrivate: draft.isPrivate,
    accessMode: draft.accessMode,
    spaceURL: draft.spaceURLInput || undefined,
  };
  if (shouldShowParticipationModeSection(space)) {
    patch.participationMode = draft.participationMode;
  }
  return patch;
}

/** updateSpaceInDb 用。access_mode は RPC 経由のため含めない。 */
export function buildPublicShareDbPatch(
  draft: PublicShareDraft,
  space: Space,
): SpaceUpdatePatch {
  const patch: SpaceUpdatePatch = {
    isPrivate: draft.isPrivate,
    spaceURL: draft.spaceURLInput || undefined,
  };
  if (!shouldShowParticipationModeSection(space)) {
    return patch;
  }
  const savedMode = normalizeParticipationMode(space.participationMode);
  if (draft.participationMode !== savedMode) {
    patch.participationMode = draft.participationMode;
  }
  return patch;
}

export function isParticipationModeDirty(
  draft: PublicShareDraft,
  space: Space,
): boolean {
  return draft.participationMode !== normalizeParticipationMode(space.participationMode);
}
