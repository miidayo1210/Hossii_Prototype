// 参加者ログイン → メールログインへ切り替える際の「戻り先スペース slug」を解決する純関数。
// state.spaces の spaceURL を最優先し、無ければ現在の URL パス（/s/... または /c/*/s/...）から拾う。
const URL_PATH_SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';
const RE_LEGACY_SPACE = new RegExp(`^\\/s\\/(${URL_PATH_SLUG})$`);
const RE_COMMUNITY_AND_SPACE = new RegExp(
  `^\\/c\\/${URL_PATH_SLUG}\\/s\\/(${URL_PATH_SLUG})$`,
);

export type SpaceSlugLookup = { id: string; spaceURL?: string | null };

export function resolveSpaceSlug(params: {
  spaceId: string | null;
  spaces: readonly SpaceSlugLookup[];
  pathname: string;
}): string | null {
  const { spaceId, spaces, pathname } = params;
  const fromState = spaceId
    ? spaces.find((s) => s.id === spaceId)?.spaceURL
    : undefined;
  if (fromState) return fromState;
  const legacy = pathname.match(RE_LEGACY_SPACE);
  if (legacy) return legacy[1];
  const community = pathname.match(RE_COMMUNITY_AND_SPACE);
  if (community) return community[1];
  return null;
}
