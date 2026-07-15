import { buildUrlWithPaneSlug, readPaneSlugFromUrl } from './paneUrl';

const URL_PATH_SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';

export const RE_CANONICAL_SPACE_PATH = new RegExp(
  `^\\/c\\/(${URL_PATH_SLUG})\\/s\\/(${URL_PATH_SLUG})$`,
);
export const RE_LEGACY_SPACE_PATH = new RegExp(`^\\/s\\/(${URL_PATH_SLUG})$`);

export function isCanonicalOrLegacySpacePath(pathname: string): boolean {
  return RE_CANONICAL_SPACE_PATH.test(pathname) || RE_LEGACY_SPACE_PATH.test(pathname);
}

export type CommunitySlugLookup = {
  communityId: string;
  communitySlug?: string | null;
};

/** スペースの community_id から canonical 用 slug を解決する。 */
export function resolveCommunitySlugForSpace(
  space: { communityId?: string | null },
  memberships: CommunitySlugLookup[],
  fallbackSlug?: string | null,
): string | null {
  if (space.communityId) {
    const match = memberships.find((m) => m.communityId === space.communityId);
    if (match?.communitySlug) return match.communitySlug;
  }
  return fallbackSlug ?? null;
}

/** 共有スペース画面の正規 pathname（/c/.../s/...）。slug が無ければ null。 */
export function buildCanonicalSpacePathname(
  communitySlug: string,
  spaceUrl: string,
): string {
  return `/c/${communitySlug}/s/${spaceUrl}`;
}

/** 画面遷移用の正規 URL（hash / ?pane= を付与可能）。 */
export function buildCanonicalSpaceScreenHref(params: {
  communitySlug: string;
  spaceUrl: string;
  paneSlug?: string | null;
  hash?: string;
}): string {
  const pathname = buildCanonicalSpacePathname(params.communitySlug, params.spaceUrl);
  const hash = params.hash ?? '#screen';
  const paneSlug = params.paneSlug ?? null;
  if (paneSlug) {
    return buildUrlWithPaneSlug(paneSlug, { pathname, search: '', hash });
  }
  return `${pathname}${hash}`;
}

/** legacy（/ や /s/...）から正規 pathname へ差し替えるべきか。 */
export function shouldReplaceWithCanonicalSpacePath(
  pathname: string,
  canonicalPathname: string,
): boolean {
  if (pathname === canonicalPathname) return false;
  if (pathname === '/' || RE_LEGACY_SPACE_PATH.test(pathname)) return true;
  return !isCanonicalOrLegacySpacePath(pathname);
}

/** 現在の location を維持しつつ pathname だけ正規化する。 */
export function replaceLocationWithCanonicalSpacePath(
  canonicalPathname: string,
  locationLike?: Pick<Location, 'pathname' | 'search' | 'hash'>,
): void {
  if (typeof window === 'undefined') return;
  const loc = locationLike ?? window.location;
  const paneSlug = readPaneSlugFromUrl(loc.search);
  const next = paneSlug
    ? buildUrlWithPaneSlug(paneSlug, {
        pathname: canonicalPathname,
        search: '',
        hash: loc.hash || '#screen',
      })
    : `${canonicalPathname}${loc.hash || '#screen'}`;
  window.history.replaceState(window.history.state, '', next);
}
