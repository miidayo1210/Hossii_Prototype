/** Private Storage bucket for challenge photo answers (not hossii-images). */
export const CHALLENGE_PHOTO_BUCKET = 'challenge-photos';

/** Fixed comment snapshot for photo responses. */
export const CHALLENGE_PHOTO_COMMENT = '写真';

/** Default signed URL lifetime (seconds). */
export const CHALLENGE_PHOTO_SIGNED_URL_EXPIRES_IN = 60 * 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Canonical object path:
 * challenge/{spaceId}/{itemId}/{userId}/{uuid}.jpg
 */
export function buildChallengePhotoStoragePath(input: {
  spaceId: string;
  itemId: string;
  userId: string;
  objectId: string;
}): string {
  const spaceId = input.spaceId.trim();
  const itemId = input.itemId.trim();
  const userId = input.userId.trim();
  const objectId = input.objectId.trim();
  if (!spaceId || !itemId || !userId || !objectId) {
    throw new Error('challenge photo path parts are required');
  }
  if (!UUID_RE.test(itemId) || !UUID_RE.test(userId) || !UUID_RE.test(objectId)) {
    throw new Error('challenge photo path ids must be uuids');
  }
  return `challenge/${spaceId}/${itemId}/${userId}/${objectId}.jpg`;
}

export function isValidChallengePhotoStoragePath(
  path: string,
  expected?: {
    spaceId: string;
    itemId: string;
    userId: string;
  },
): boolean {
  const trimmed = path.trim();
  if (!trimmed || trimmed.includes('..') || trimmed.includes('//')) return false;
  const parts = trimmed.split('/');
  if (parts.length !== 5) return false;
  const [root, spaceId, itemId, userId, fileName] = parts;
  if (root !== 'challenge') return false;
  if (!spaceId || !UUID_RE.test(itemId) || !UUID_RE.test(userId)) return false;
  if (!fileName.toLowerCase().endsWith('.jpg')) return false;
  const objectId = fileName.slice(0, -'.jpg'.length);
  if (!UUID_RE.test(objectId)) return false;
  if (expected) {
    if (spaceId !== expected.spaceId.trim()) return false;
    if (itemId !== expected.itemId.trim()) return false;
    if (userId !== expected.userId.trim()) return false;
  }
  return true;
}
