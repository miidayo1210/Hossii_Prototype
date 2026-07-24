/** /admin/login で AdminLoginScreen を隠すか（loading 差し替え） */
export function shouldBlockAdminLoginScreen(
  isInitialAuthLoading: boolean,
  currentUser: { isAdmin?: boolean } | null | undefined,
): boolean {
  if (currentUser?.isAdmin) return true;
  // 初回セッション解決中のみ loading。signOut 等の isResolvingAuth ではフォームを維持し error を消さない。
  if (isInitialAuthLoading && currentUser == null) return true;
  return false;
}

export type RevokeAdminLoginSessionDeps = {
  signOut: () => Promise<{ error: { message: string } | null }>;
  clearStoredCommunityId: () => void;
  clearCurrentUser: () => void;
  logSignOutFailure: (error: unknown) => void;
};

/** 管理者権限不足時: 一般ユーザーセッションを残さず admin login 画面を安定させる */
export async function revokeSessionAfterAdminAccessDenied(
  deps: RevokeAdminLoginSessionDeps,
): Promise<void> {
  try {
    const { error } = await deps.signOut();
    if (error) deps.logSignOutFailure(error);
  } catch (error) {
    deps.logSignOutFailure(error);
  }
  deps.clearStoredCommunityId();
  deps.clearCurrentUser();
}
