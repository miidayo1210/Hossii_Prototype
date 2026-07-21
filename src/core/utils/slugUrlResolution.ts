const URL_PATH_SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';
const RE_PATH_COMMUNITY_AND_SPACE = new RegExp(
  `^\\/c\\/${URL_PATH_SLUG}\\/s\\/(${URL_PATH_SLUG})$`,
);
const RE_PATH_LEGACY_SPACE = new RegExp(`^\\/s\\/(${URL_PATH_SLUG})$`);
export const RE_IS_SLUG_URL_PATH = new RegExp(
  `^\\/c\\/${URL_PATH_SLUG}\\/s\\/${URL_PATH_SLUG}$|^\\/s\\/${URL_PATH_SLUG}$`,
);

export type SlugFetchOutcome = 'idle' | 'loading' | 'hit' | 'miss';

export function parseSpaceSlugFromPathname(pathname: string): string | null {
  const communitySpaceMatch = pathname.match(RE_PATH_COMMUNITY_AND_SPACE);
  if (communitySpaceMatch) return communitySpaceMatch[1];
  const legacyMatch = pathname.match(RE_PATH_LEGACY_SPACE);
  return legacyMatch?.[1] ?? null;
}

/** slug 直リンクの解決中は not-found や SpaceScreen の unavailable を出さない。 */
export function isSlugUrlStillResolving(input: {
  isOnSlugPath: boolean;
  slugFetchOutcome: SlugFetchOutcome;
  slugFromPath: string | null;
  hasSlugSpaceInStore: boolean;
  slugAccessPending: boolean;
  spaceURLNotFound: boolean;
  guestSpaceId: string | null;
  guestSpaceIsPrivate: boolean;
}): boolean {
  if (!input.isOnSlugPath) return false;
  if (input.spaceURLNotFound) return false;
  if (input.guestSpaceId || input.guestSpaceIsPrivate) return false;
  if (input.slugFetchOutcome === 'miss') return false;
  if (input.slugAccessPending) return true;
  if (input.slugFetchOutcome === 'loading') return true;
  if (input.slugFromPath && !input.hasSlugSpaceInStore) return true;
  return false;
}
