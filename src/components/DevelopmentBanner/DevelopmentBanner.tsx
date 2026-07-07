import { createPortal } from 'react-dom';
import { supabaseEnvironmentValidation } from '../../core/supabase';
import {
  DEVELOPMENT_BANNER_POINTER_EVENTS,
  DEVELOPMENT_BANNER_Z_INDEX,
  shouldRenderDevelopmentBanner,
} from './developmentBannerLayer';
import styles from './DevelopmentBanner.module.css';

export function DevelopmentBanner() {
  if (!shouldRenderDevelopmentBanner(supabaseEnvironmentValidation)) {
    return null;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className={styles.developmentBanner}
      style={{
        zIndex: DEVELOPMENT_BANNER_Z_INDEX,
        pointerEvents: DEVELOPMENT_BANNER_POINTER_EVENTS,
      }}
      aria-hidden="true"
      title="Development environment"
      data-development-banner=""
    >
      DEV
    </div>,
    document.body,
  );
}
