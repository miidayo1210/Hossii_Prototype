import { supabase, isSupabaseConfigured } from '../supabase';

const BUCKET = 'hossii-images';
const MAX_SIZE_BYTES = 1024 * 1024; // 1MB
const MAX_DIMENSION = 1280;

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

/** Supabase Storage に画像をアップロードして公開 URL を返す */
export async function uploadHossiiImage(
  spaceId: string,
  hossiiId: string,
  file: File
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

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
