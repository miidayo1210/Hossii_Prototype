const PANE_PARAM = 'pane';

/** Read `?pane=` slug from current location (null if absent or empty). */
export function readPaneSlugFromUrl(search?: string): string | null {
  const raw =
    search ??
    (typeof window !== 'undefined' ? window.location.search : '');
  const slug = new URLSearchParams(raw).get(PANE_PARAM);
  if (!slug || slug.trim() === '') return null;
  return slug;
}

/** Build URL string with pane query param set or removed; preserves pathname and hash. */
export function buildUrlWithPaneSlug(
  slug: string | null,
  locationLike?: Pick<Location, 'pathname' | 'search' | 'hash'>,
): string {
  const loc =
    locationLike ??
    (typeof window !== 'undefined'
      ? window.location
      : { pathname: '/', search: '', hash: '' });

  const params = new URLSearchParams(loc.search);
  if (slug) {
    params.set(PANE_PARAM, slug);
  } else {
    params.delete(PANE_PARAM);
  }

  const query = params.toString();
  return `${loc.pathname}${query ? `?${query}` : ''}${loc.hash}`;
}

export function pushPaneSlug(slug: string): void {
  if (typeof window === 'undefined') return;
  const url = buildUrlWithPaneSlug(slug);
  window.history.pushState(window.history.state, '', url);
}

export function replacePaneSlug(slug: string | null): void {
  if (typeof window === 'undefined') return;
  const url = buildUrlWithPaneSlug(slug);
  window.history.replaceState(window.history.state, '', url);
}
