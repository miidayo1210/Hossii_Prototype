import { supabase, isSupabaseConfigured } from '../supabase';

const BUCKET = 'hossii-images';
const MAX_SIZE_BYTES = 1024 * 1024; // 1MB
const MAX_DIMENSION = 1280;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function validateImageFile(file: File): void {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`サポートされていないファイル形式です。JPEG・PNG・WebP・GIF のみアップロードできます。（受信: ${file.type || '不明'}）`);
  }
}

/** Canvas API でクライアント側圧縮 */
export async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas toBlob failed'));
              return;
            }
            if (blob.size <= MAX_SIZE_BYTES || quality <= 0.4) {
              resolve(blob);
            } else {
              quality -= 0.1;
              tryCompress();
            }
          },
          'image/jpeg',
          quality
        );
      };
      tryCompress();
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };

    img.src = url;
  });
}

export type BackgroundUploadResult =
  | { ok: true; publicUrl: string }
  | { ok: false; reason: string; details?: unknown };

/** Supabase Storage にスペース背景画像をアップロードして公開 URL を返す */
export async function uploadBackgroundImage(
  spaceId: string,
  file: File,
): Promise<BackgroundUploadResult> {
  if (!isSupabaseConfigured) {
    console.error('[BackgroundUpload] Supabase 未設定');
    return { ok: false, reason: 'Supabase 未設定' };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error('[BackgroundUpload] セッション取得失敗:', sessionError);
    return { ok: false, reason: 'セッション取得失敗', details: sessionError };
  }
  if (!sessionData.session) {
    console.error('[BackgroundUpload] 未ログイン — Storage RLS (authenticated) によりアップロード不可');
    return { ok: false, reason: '未ログイン（ログインが必要です）' };
  }

  console.info('[BackgroundUpload] start', {
    spaceId,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    userId: sessionData.session.user.id,
  });

  try {
    validateImageFile(file);
  } catch (err) {
    console.error('[BackgroundUpload] ファイル形式エラー:', err);
    return { ok: false, reason: err instanceof Error ? err.message : 'ファイル形式エラー', details: err };
  }

  let blob: Blob;
  try {
    blob = await compressImage(file);
    console.info('[BackgroundUpload] 圧縮完了', { size: blob.size });
  } catch (err) {
    console.warn('[BackgroundUpload] 圧縮失敗、元ファイルを使用:', err);
    blob = file;
  }

  const timestamp = Date.now();
  const path = `backgrounds/${spaceId}/${timestamp}.jpg`;
  console.info('[BackgroundUpload] uploading', { bucket: BUCKET, path });

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) {
    console.error('[BackgroundUpload] Storage upload 失敗:', {
      message: error.message,
      name: error.name,
      path,
      spaceId,
      statusCode: (error as { statusCode?: string }).statusCode,
      error,
    });
    return { ok: false, reason: error.message, details: error };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  console.info('[BackgroundUpload] 成功:', data.publicUrl);
  return { ok: true, publicUrl: data.publicUrl };
}

/** Supabase Storage から背景画像を削除する */
export async function deleteBackgroundImage(publicUrl: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  // 公開 URL からストレージパスを抽出
  // 例: https://xxx.supabase.co/storage/v1/object/public/hossii-images/backgrounds/spaceId/ts.jpg
  const marker = `/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) {
    console.warn('[imageStorageApi] deleteBackgroundImage: cannot parse path from URL', publicUrl);
    return;
  }
  const path = publicUrl.slice(idx + marker.length);

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    console.error('[imageStorageApi] deleteBackgroundImage error:', error.message);
  }
}

/** Supabase Storage に画像をアップロードして公開 URL を返す */
export async function uploadHossiiImage(
  spaceId: string,
  hossiiId: string,
  file: File
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  validateImageFile(file);

  let blob: Blob;
  try {
    blob = await compressImage(file);
  } catch {
    blob = file;
  }

  const path = `${spaceId}/${hossiiId}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

  if (error) {
    console.error('[imageStorageApi] upload error:', error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** キャンバス投稿用（Phase 1: 最大 5MB、PNG/WebP Blob をそのまま） */
const CANVAS_MAX_BYTES = 5 * 1024 * 1024;

export async function uploadCanvasPostImage(
  spaceId: string,
  hossiiId: string,
  blob: Blob,
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  if (blob.size > CANVAS_MAX_BYTES) {
    console.error('[imageStorageApi] uploadCanvasPostImage: blob exceeds 5MB');
    return null;
  }

  const mime = blob.type || 'image/png';
  const ext = mime.includes('webp') ? 'webp' : 'png';
  const path = `canvas/${spaceId}/${hossiiId}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: mime || 'image/png', upsert: true });

  if (error) {
    console.error('[imageStorageApi] uploadCanvasPostImage error:', error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

import { MY_HOSSII_AVATAR_FILENAME } from './myHossiiImagePath';

export type MyHossiiUploadResult =
  | { ok: true; storagePath: string; publicUrl: string }
  | { ok: false; reason: string; details?: unknown };

/** マイHossii用アバター画像をアップロード（本人の avatars/{uid}/ 配下のみ） */
export async function uploadMyHossiiAvatar(
  userId: string,
  file: File,
): Promise<MyHossiiUploadResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, reason: 'Supabase 未設定' };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    return { ok: false, reason: '未ログイン（ログインが必要です）' };
  }

  if (sessionData.session.user.id !== userId) {
    return { ok: false, reason: '本人のみアップロードできます' };
  }

  try {
    validateImageFile(file);
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'ファイル形式エラー',
      details: err,
    };
  }

  let blob: Blob;
  try {
    blob = await compressImage(file);
  } catch (err) {
    console.warn('[imageStorageApi] uploadMyHossiiAvatar: compress failed, using original', err);
    blob = file;
  }

  const path = `avatars/${userId}/${MY_HOSSII_AVATAR_FILENAME}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: true });

  if (error) {
    console.error('[imageStorageApi] uploadMyHossiiAvatar error:', error.message);
    return { ok: false, reason: error.message, details: error };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, storagePath: path, publicUrl: data.publicUrl };
}

/** Storage path からマイHossii画像を削除 */
export async function deleteMyHossiiImageByPath(storagePath: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured || !storagePath) return;

  const expectedPrefix = `avatars/${userId}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    console.warn('[imageStorageApi] deleteMyHossiiImageByPath: path does not belong to user', storagePath);
    return;
  }

  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) {
    console.warn('[imageStorageApi] deleteMyHossiiImageByPath error:', error.message);
  }
}

export { MY_HOSSII_AVATAR_FILENAME };
