import { createClient } from '@supabase/supabase-js';
import {
  isSupabaseClientConfigured,
  readSupabaseEnvironmentConfig,
  validateSupabaseEnvironment,
  type SupabaseEnvironmentValidation,
} from './supabaseEnvironment';

const environmentConfig = readSupabaseEnvironmentConfig();
const environmentValidation = validateSupabaseEnvironment(environmentConfig);

const configuredUrl = environmentConfig.supabaseUrl ?? '';
const configuredAnonKey = environmentConfig.supabaseAnonKey ?? '';
const clientUrl = isSupabaseClientConfigured(environmentConfig)
  ? configuredUrl
  : 'https://placeholder.supabase.co';
const clientAnonKey = isSupabaseClientConfigured(environmentConfig)
  ? configuredAnonKey
  : 'placeholder-anon-key';

// Navigator LockManager の競合（複数タブ同時アクセス時のタイムアウト）を回避するため、
// ロック取得をスキップして直接実行するカスタムロックを設定する。
export const supabase = createClient(clientUrl, clientAnonKey, {
  auth: {
    lock: async <R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> => fn(),
  },
});

export const isSupabaseConfigured = environmentValidation.isConfigured;

export const supabaseEnvironmentValidation: SupabaseEnvironmentValidation =
  environmentValidation;

/** DB 接続先の比較用（local dev と deploy が同じ Supabase か確認） */
export function getSupabaseProjectHost(): string | null {
  if (!isSupabaseConfigured) return null;
  try {
    return new URL(configuredUrl).host;
  } catch {
    return null;
  }
}

if (
  environmentValidation.shouldBlockApp &&
  environmentValidation.errorMessage &&
  import.meta.env.MODE !== 'test'
) {
  console.error('[supabase] Configuration error:', environmentValidation.errorMessage);
}
