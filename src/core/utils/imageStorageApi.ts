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

/** Supabase Storage にスペース背景画像をアップロードして公開 URL を返す */
export async function uploadBackgroundImage(
  spaceId: string,
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

  // タイムスタンプで一意なファイル名を生成（同スペースに複数枚保存可能）
  const timestamp = Date.now();
  const path = `backgrounds/${spaceId}/${timestamp}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) {
    console.error('[imageStorageApi] uploadBackgroundImage error:', error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
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
