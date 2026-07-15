/** DB / RPC が返すアーカイブ中書き込み拒否メッセージ（112 仕様）。 */
export const SPACE_ARCHIVE_WRITE_BLOCKED_MESSAGE =
  'このスペースはアーカイブされているため変更できません';

export const SPACE_ARCHIVE_POST_DISABLED_MESSAGE =
  'アーカイブ中のため、新しい投稿はできません';

export function isSpaceArchiveWriteBlockedError(message: string | null | undefined): boolean {
  return (message ?? '').includes(SPACE_ARCHIVE_WRITE_BLOCKED_MESSAGE);
}

/** 表示中スペースが閲覧専用アーカイブか（UI 正本: space.isArchived）。 */
export function isSpaceArchivedReadOnly(
  space: { isArchived?: boolean } | null | undefined,
): boolean {
  return space?.isArchived === true;
}

export function resolveLikesEnabledForArchivedSpace(
  isArchived: boolean,
  likesEnabled: boolean,
): boolean {
  return !isArchived && likesEnabled;
}

export function resolveBubbleCanEditForArchivedSpace(
  isArchived: boolean,
  canEdit: boolean,
): boolean {
  return !isArchived && canEdit;
}

export function resolveCanManageOwnForArchivedSpace(
  isArchived: boolean,
  canManage: boolean,
): boolean {
  return !isArchived && canManage;
}
