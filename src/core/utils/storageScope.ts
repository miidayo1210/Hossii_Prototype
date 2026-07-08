import { extractProjectRefFromSupabaseUrl } from '../supabaseEnvironment';

/**
 * Supabase Project ref ごとに localStorage キーを分離する。
 * Production / Development 切替時に端末 profile やスペース一覧が混ざらないようにする。
 */
export function getStorageScopePrefix(): string {
  const expectedRef = import.meta.env.VITE_EXPECTED_SUPABASE_REF;
  if (typeof expectedRef === 'string' && expectedRef.length > 0) {
    return expectedRef;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (typeof supabaseUrl === 'string') {
    const extracted = extractProjectRefFromSupabaseUrl(supabaseUrl);
    if (extracted) return extracted;
  }

  return 'local';
}

export function scopedStorageKey(baseKey: string): string {
  return `${getStorageScopePrefix()}:${baseKey}`;
}
