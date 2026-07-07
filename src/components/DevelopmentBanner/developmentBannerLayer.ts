import type { SupabaseEnvironmentValidation } from '../../core/supabaseEnvironment';

/** スペース UI（~600）より上、モーダル（~998）より下 */
export const DEVELOPMENT_BANNER_Z_INDEX = 900;

export const DEVELOPMENT_BANNER_POINTER_EVENTS = 'none' as const;

export const DEVELOPMENT_BANNER_PORTAL_TARGET = 'document.body' as const;

export function shouldRenderDevelopmentBanner(
  validation: Pick<SupabaseEnvironmentValidation, 'shouldShowDevBanner'>,
): boolean {
  return validation.shouldShowDevBanner;
}
