const MY_HOSSII_AVATAR_FILENAME = 'my-hossii.webp';

/** マイHossiiアップロード画像の Storage path が本人のものか検証 */
export function isValidMyHossiiImagePathForUser(
  imagePath: string | null | undefined,
  userId: string,
): boolean {
  if (!imagePath || !userId) return false;
  return imagePath === `avatars/${userId}/${MY_HOSSII_AVATAR_FILENAME}`;
}

export { MY_HOSSII_AVATAR_FILENAME };
