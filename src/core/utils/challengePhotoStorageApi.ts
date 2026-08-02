import { supabase, isSupabaseConfigured } from '../supabase';
import {
  CHALLENGE_PHOTO_BUCKET,
  CHALLENGE_PHOTO_SIGNED_URL_EXPIRES_IN,
  isValidChallengePhotoStoragePath,
} from './challengePhoto';

export type ChallengePhotoSignedUrlResult =
  | { ok: true; signedUrl: string; expiresIn: number }
  | { ok: false; error: string; code?: string };

/**
 * Upload a JPEG object to the private challenge-photos bucket.
 * Path must be owner-owned; Storage RLS enforces membership + folder ownership.
 */
export async function uploadChallengePhotoObject(
  photoPath: string,
  body: Blob | ArrayBuffer | ArrayBufferView,
): Promise<{ ok: true; photoPath: string } | { ok: false; error: string }> {
  const path = photoPath.trim();
  if (!path || !isValidChallengePhotoStoragePath(path)) {
    return { ok: false, error: 'photoPath is invalid' };
  }
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  const { error } = await supabase.storage.from(CHALLENGE_PHOTO_BUCKET).upload(path, body, {
    contentType: 'image/jpeg',
    upsert: false,
  });

  if (error) {
    console.error('[challengePhotoStorageApi] uploadChallengePhotoObject:', error.message);
    return { ok: false, error: error.message || '写真のアップロードに失敗しました' };
  }
  return { ok: true, photoPath: path };
}

/**
 * Issue a short-lived signed URL for a challenge photo.
 * Authorization is enforced by Storage RLS (same rules as response visibility).
 * Callers must already be allowed to SELECT the object.
 */
export async function createChallengePhotoSignedUrl(
  photoPath: string,
  expiresIn: number = CHALLENGE_PHOTO_SIGNED_URL_EXPIRES_IN,
): Promise<ChallengePhotoSignedUrlResult> {
  const path = photoPath.trim();
  if (!path) {
    return { ok: false, error: 'photoPath is required' };
  }
  if (!isValidChallengePhotoStoragePath(path)) {
    return { ok: false, error: 'photoPath is invalid' };
  }
  if (!Number.isFinite(expiresIn) || expiresIn < 1) {
    return { ok: false, error: 'expiresIn must be a positive number of seconds' };
  }
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  const { data, error } = await supabase.storage
    .from(CHALLENGE_PHOTO_BUCKET)
    .createSignedUrl(path, Math.floor(expiresIn));

  if (error || !data?.signedUrl) {
    console.error(
      '[challengePhotoStorageApi] createChallengePhotoSignedUrl:',
      error?.message,
    );
    const statusCode =
      error && 'statusCode' in error
        ? String((error as { statusCode?: string }).statusCode ?? '')
        : '';
    const message = error?.message?.toLowerCase() ?? '';
    if (message.includes('not found') || statusCode === '404') {
      return { ok: false, error: '写真が見つかりません', code: statusCode || undefined };
    }
    if (
      message.includes('policy') ||
      message.includes('permission') ||
      message.includes('denied') ||
      message.includes('row-level security')
    ) {
      return { ok: false, error: '権限がありません', code: '42501' };
    }
    return {
      ok: false,
      error: error?.message || '署名URLの取得に失敗しました',
      code: statusCode || undefined,
    };
  }

  return { ok: true, signedUrl: data.signedUrl, expiresIn: Math.floor(expiresIn) };
}

/**
 * Delete a challenge photo object. Owner-only via Storage RLS.
 * Used before response DELETE, or best-effort after rewrite.
 */
export async function deleteChallengePhotoObject(
  photoPath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const path = photoPath.trim();
  if (!path) {
    return { ok: false, error: 'photoPath is required' };
  }
  if (!isValidChallengePhotoStoragePath(path)) {
    return { ok: false, error: 'photoPath is invalid' };
  }
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured' };
  }

  const { error } = await supabase.storage.from(CHALLENGE_PHOTO_BUCKET).remove([path]);
  if (error) {
    console.error('[challengePhotoStorageApi] deleteChallengePhotoObject:', error.message);
    return { ok: false, error: error.message || '写真の削除に失敗しました' };
  }
  return { ok: true };
}
