/** DB / RPC が返すアーカイブ中書き込み拒否メッセージ（112 仕様）。 */
export const SPACE_ARCHIVE_WRITE_BLOCKED_MESSAGE =
  'このスペースはアーカイブされているため変更できません';

export function isSpaceArchiveWriteBlockedError(message: string | null | undefined): boolean {
  return (message ?? '').includes(SPACE_ARCHIVE_WRITE_BLOCKED_MESSAGE);
}
