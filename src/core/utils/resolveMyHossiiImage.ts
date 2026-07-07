import { resolveHossiiPresetImagePath } from '../assets/hossiiPresets';
import { supabase, isSupabaseConfigured } from '../supabase';
import type { MyHossiiParticipant } from '../types/myHossii';
import { HOSSII_IDLE } from '../assets/hossiiIdle';
import { isValidMyHossiiImagePathForUser } from './myHossiiImagePath';

const DEFAULT_MY_HOSSII_IMAGE = HOSSII_IDLE.base;

function resolveUploadPublicUrl(path: string): string {
  if (!isSupabaseConfigured) return path;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) {
    return path;
  }
  const { data } = supabase.storage.from('hossii-images').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * マイHossiiの表示画像を解決する。
 * upload + path → プリセット → デフォルト idle
 * 他人の Storage path は拒否する。
 */
export function resolveMyHossiiImage(
  participant: Pick<
    MyHossiiParticipant,
    'userId' | 'hossiiSourceType' | 'hossiiPresetKey' | 'hossiiImagePath'
  >,
): string {
  if (
    participant.hossiiSourceType === 'upload' &&
    participant.hossiiImagePath &&
    isValidMyHossiiImagePathForUser(participant.hossiiImagePath, participant.userId)
  ) {
    return resolveUploadPublicUrl(participant.hossiiImagePath);
  }
  if (participant.hossiiSourceType === 'preset' && participant.hossiiPresetKey) {
    return resolveHossiiPresetImagePath(participant.hossiiPresetKey) ?? DEFAULT_MY_HOSSII_IMAGE;
  }
  return DEFAULT_MY_HOSSII_IMAGE;
}

export { DEFAULT_MY_HOSSII_IMAGE };
