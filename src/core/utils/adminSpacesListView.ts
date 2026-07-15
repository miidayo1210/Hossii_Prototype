import type { Space } from '../types/space';

/** #spaces 管理者一覧: 選択コミュニティ内の shared / personal を分離する。 */
export function partitionAdminCommunitySpaces(
  spaces: Space[],
  communityId: string | undefined,
): { sharedSpaces: Space[]; personalSpaces: Space[] } {
  const scoped = communityId
    ? spaces.filter((s) => s.communityId === communityId)
    : spaces;

  return {
    sharedSpaces: scoped.filter((s) => s.spaceType !== 'personal'),
    personalSpaces: scoped.filter((s) => s.spaceType === 'personal'),
  };
}
