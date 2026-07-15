export function resolveCommunitySummary(
  isLoggedIn: boolean,
  communityName: string | null | undefined,
): string {
  if (!isLoggedIn) return '未ログイン';
  if (!communityName) return '未所属';
  return communityName;
}
