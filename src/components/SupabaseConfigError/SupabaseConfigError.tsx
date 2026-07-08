import { supabaseEnvironmentValidation } from '../../core/supabase';
import styles from './SupabaseConfigError.module.css';

export function SupabaseConfigError() {
  const message =
    supabaseEnvironmentValidation.errorMessage ??
    'Supabase 環境設定を確認できませんでした。';

  return (
    <div className={styles.configError}>
      <div className={styles.card}>
        <h1 className={styles.title}>Supabase 設定エラー</h1>
        <p className={styles.message}>{message}</p>
        <p className={styles.hint}>
          VITE_APP_ENV、VITE_EXPECTED_SUPABASE_REF、VITE_SUPABASE_URL の組み合わせを確認してください。
        </p>
      </div>
    </div>
  );
}
