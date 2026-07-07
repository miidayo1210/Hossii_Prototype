import { getProjectRefSuffix } from '../../core/supabaseEnvironment';
import { supabaseEnvironmentValidation } from '../../core/supabase';
import styles from './DevelopmentBanner.module.css';

export function DevelopmentBanner() {
  if (!supabaseEnvironmentValidation.shouldShowDevBanner) {
    return null;
  }

  const suffix = getProjectRefSuffix(supabaseEnvironmentValidation.actualProjectRef);

  return (
    <div
      className={styles.developmentBanner}
      aria-hidden="true"
      title={suffix ? `Development ···${suffix}` : 'Development'}
    >
      DEV
    </div>
  );
}
