import type { Hossii } from '../types';
import { isSupabaseConfigured } from '../supabase';
import { DEMO_MAX_HOSSIIS, saveHossiis } from './storage';

/**
 * Supabase 有効時は投稿全件を localStorage に書かない（87 §10.1）。
 * デモビルドのみ cap 付きで永続化。
 */
export function persistHossiisLocal(hossiis: Hossii[]): void {
  if (isSupabaseConfigured) return;
  const capped =
    hossiis.length > DEMO_MAX_HOSSIIS
      ? hossiis.slice(hossiis.length - DEMO_MAX_HOSSIIS)
      : hossiis;
  saveHossiis(capped);
}
