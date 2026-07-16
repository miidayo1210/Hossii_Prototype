export function resolveCommunitySummary(
  isLoggedIn: boolean,
  communityName: string | null | undefined,
): string {
  if (!isLoggedIn) return '未ログイン';
  if (!communityName) return '未所属';
  return communityName;
}

export function resolveCommunitySummaryLabel(
  loading: boolean,
  isLoggedIn: boolean,
  communityName: string | null | undefined,
): string {
  if (loading) return '読み込み中';
  return resolveCommunitySummary(isLoggedIn, communityName);
}
