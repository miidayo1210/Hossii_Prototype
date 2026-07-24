import { useEffect, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../supabase';
import { fetchCommunitiesByAdminId, createCommunity } from '../utils/communitiesApi';
import type { Community, CommunityStatus } from '../utils/communitiesApi';
import { resolveSpacesCommunityId } from '../utils/adminCommunityScope';
import {
  upsertUserProfile,
  fetchUserProfile,
  ensureUserProfileExists,
} from '../utils/userProfilesApi';
import {
  resolveParticipantLogin,
  markParticipantFirstLogin,
} from '../utils/participantAccountsApi';
import { fetchLegacyDefaultNickname } from '../utils/profilesApi';
import {
  clearStoredCommunityId,
  loadStoredCommunityId,
  saveStoredCommunityId,
} from '../utils/selectedCommunityStorage';
import { AdminAccessDeniedError } from '../auth/adminAccessDeniedError';
import { revokeSessionAfterAdminAccessDenied } from '../auth/adminLoginFlow';
import { AuthContext } from './useAuth';

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  isIssuedParticipant?: boolean;
  username?: string;
  communityId?: string;
  communityName?: string;
  communitySlug?: string;
  communityStatus?: CommunityStatus;
  /** 本人が admin_id として所有するコミュニティ（#spaces スコープ検証用） */
  adminCommunities?: Array<{
    id: string;
    name: string;
    slug: string | null;
    status: CommunityStatus;
  }>;
};

export type AuthContextType = {
  currentUser: AppUser | null;
  loading: boolean;
  isResolvingAuth: boolean;
  signUp: (
    email: string,
    password: string,
    username: string,
    birthdate?: string | null,
    gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null
  ) => Promise<AppUser>;
  login: (email: string, password: string) => Promise<AppUser>;
  loginParticipant: (spaceId: string, loginId: string, password: string) => Promise<AppUser>;
  adminLogin: (email: string, password: string) => Promise<AppUser>;
  adminSignUp: (email: string, password: string, communityName: string) => Promise<AppUser>;
  logout: () => Promise<void>;
  loginWithGoogle: (asAdmin?: boolean) => Promise<AppUser>;
  loginWithFacebook: () => Promise<AppUser>;
  refreshCommunitySlug: (newSlug: string) => void;
};

type AuthProviderProps = {
  children: ReactNode;
};

function summarizeAdminCommunities(communities: Community[]) {
  return communities.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    status: c.status,
  }));
}

function resolveOwnedCommunityScope(
  managedCommunities: Community[],
  storedCommunityId: string | null,
): { communityId: string | null; community: Community | null } {
  const resolvedId = resolveSpacesCommunityId({
    overrideCommunityId: null,
    selectedCommunityId: storedCommunityId,
    fallbackCommunityId: null,
    managedCommunities,
    isSuperAdmin: false,
  });
  const community = resolvedId
    ? managedCommunities.find((c) => c.id === resolvedId) ?? null
    : null;
  return { communityId: resolvedId, community };
}

/**
 * Supabase User → AppUser（非同期: communities テーブルで管理者チェック）
 * app_metadata.role = "admin" は承認済みとして扱う（Supabase Dashboard で手動設定した場合）
 * communities.status が 'approved' のときのみ isAdmin: true
 */
async function resolveAppUser(user: User): Promise<AppUser> {
  const roleFromMetadata = user.app_metadata?.role as string | undefined;
  const isIssuedParticipant = user.app_metadata?.participant === true;
  const displayName = user.user_metadata?.display_name as string | null ?? null;

  // スーパー管理者（Hossii 運営）の判定
  if (roleFromMetadata === 'super_admin') {
    return {
      uid: user.id,
      email: user.email ?? null,
      displayName: displayName ?? 'Hossii 運営',
      isAdmin: true,
      isSuperAdmin: true,
    };
  }

  // communities テーブルで本人が所有するコミュニティ一覧を取得
  const [managedCommunities, userProfileResult] = await Promise.all([
    fetchCommunitiesByAdminId(user.id),
    fetchUserProfile(user.id).catch((error) => {
      console.error('[AuthContext] fetchUserProfile error:', error);
      return null;
    }),
  ]);
  const adminCommunities = summarizeAdminCommunities(managedCommunities);
  const storedCommunityId = loadStoredCommunityId();
  const { communityId: resolvedCommunityId, community: resolvedCommunity } =
    resolveOwnedCommunityScope(managedCommunities, storedCommunityId);

  if (resolvedCommunityId && resolvedCommunityId !== storedCommunityId) {
    saveStoredCommunityId(resolvedCommunityId);
  }

  const hasApprovedManaged = managedCommunities.some((c) => c.status === 'approved');
  const displayCommunity =
    resolvedCommunity ?? managedCommunities[0] ?? null;

  let resolvedProfile = userProfileResult;
  if (!resolvedProfile && isIssuedParticipant) {
    try {
      resolvedProfile = await ensureUserProfileExists(user.id);
    } catch (error) {
      console.error('[AuthContext] ensureUserProfileExists error:', error);
    }
  }

  let username = resolvedProfile?.username?.trim() || undefined;
  if (!username) {
    const legacyNickname = await fetchLegacyDefaultNickname(user.id);
    if (legacyNickname) {
      username = legacyNickname;
    }
  }

  // app_metadata.role = "admin" は承認済みとして扱う
  if (roleFromMetadata === 'admin') {
    return {
      uid: user.id,
      email: user.email ?? null,
      displayName: displayName ?? displayCommunity?.name ?? null,
      isAdmin: true,
      username,
      communityId: resolvedCommunityId ?? undefined,
      communityName: displayCommunity?.name,
      communitySlug: displayCommunity?.slug ?? undefined,
      communityStatus: displayCommunity?.status,
      adminCommunities,
    };
  }

  if (managedCommunities.length === 0) {
    return {
      uid: user.id,
      email: user.email ?? null,
      displayName,
      isAdmin: false,
      username,
      isIssuedParticipant,
    };
  }

  return {
    uid: user.id,
    email: user.email ?? null,
    displayName: displayName ?? displayCommunity?.name ?? null,
    isAdmin: hasApprovedManaged,
    username,
    communityId: resolvedCommunityId ?? undefined,
    communityName: displayCommunity?.name,
    communitySlug: displayCommunity?.slug ?? undefined,
    communityStatus: displayCommunity?.status,
    isIssuedParticipant,
    adminCommunities,
  };
}

// ===== Mock 認証（Supabase 未設定時のフォールバック）=====

const MOCK_AUTH_KEY = 'mock_auth_user';

type MockUser = AppUser;

const createMockUser = (email: string, uid?: string, isAdmin = false, communityName?: string): MockUser => ({
  uid: uid || `user-${Date.now()}`,
  email,
  displayName: communityName ?? email.split('@')[0] ?? 'Demo User',
  isAdmin,
  username: undefined,
  communityName,
});

const checkIsAdmin = (email: string): boolean =>
  email.toLowerCase().includes('admin');

const saveMockUser = (user: MockUser) =>
  localStorage.setItem(MOCK_AUTH_KEY, JSON.stringify(user));

const loadMockUser = (): MockUser | null => {
  const stored = localStorage.getItem(MOCK_AUTH_KEY);
  if (!stored) return null;
  try { return JSON.parse(stored); } catch { return null; }
};

const clearMockUser = () => localStorage.removeItem(MOCK_AUTH_KEY);

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() =>
    !isSupabaseConfigured ? loadMockUser() : null
  );
  const [loading, setLoading] = useState(() => isSupabaseConfigured);
  const [isResolvingAuth, setIsResolvingAuth] = useState(false);

  // ===== セッション初期化 =====
  // onAuthStateChange の INITIAL_SESSION イベントで初期セッションを処理することで、
  // getSession + onAuthStateChange の二重発火（競合）を防ぐ
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') {
          // 初回セッション確認完了（getSession 相当）
          if (session) {
            const appUser = await resolveAppUser(session.user);
            setCurrentUser(appUser);
          }
          setLoading(false);
          return;
        }

        // 以降の認証状態変化（ログイン・ログアウト・トークンリフレッシュ等）
        setIsResolvingAuth(true);
        if (session) {
          const appUser = await resolveAppUser(session.user);
          setCurrentUser(appUser);
        } else {
          setCurrentUser(null);
        }
        setIsResolvingAuth(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ===== 参加者サインアップ =====
  const signUp = useCallback(async (
    email: string,
    password: string,
    username: string,
    birthdate?: string | null,
    gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null
  ): Promise<AppUser> => {
    if (!isSupabaseConfigured) {
      const user: AppUser = { ...createMockUser(email), username };
      setCurrentUser(user);
      saveMockUser(user);
      return user;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) throw error ?? new Error('Sign up failed');

    await upsertUserProfile(data.user.id, username, birthdate, gender);

    return resolveAppUser(data.user);
  }, []);

  // ===== 管理者発行参加者ログイン =====
  const loginParticipant = useCallback(async (
    spaceId: string,
    loginId: string,
    password: string
  ): Promise<AppUser> => {
    if (!isSupabaseConfigured) {
      const user: AppUser = {
        ...createMockUser(`${loginId}@participants.internal`, `participant-${loginId}`),
        isIssuedParticipant: true,
      };
      setCurrentUser(user);
      saveMockUser(user);
      return user;
    }

    const authEmail = await resolveParticipantLogin(spaceId, loginId);
    if (!authEmail) {
      throw new Error('参加 ID またはパスワードが正しくありません');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });
    if (error || !data.user) {
      throw error ?? new Error('Login failed');
    }

    await markParticipantFirstLogin(data.user.id);
    try {
      await ensureUserProfileExists(data.user.id);
    } catch (error) {
      console.error('[AuthContext] ensureUserProfileExists on participant login:', error);
    }
    return resolveAppUser(data.user);
  }, []);

  // ===== 参加者ログイン =====
  const login = useCallback(async (email: string, password: string): Promise<AppUser> => {
    if (!isSupabaseConfigured) {
      const user = createMockUser(email);
      setCurrentUser(user);
      saveMockUser(user);
      return user;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw error ?? new Error('Login failed');
    return resolveAppUser(data.user);
  }, []);

  // ===== 管理者ログイン =====
  const adminLogin = useCallback(async (email: string, password: string): Promise<AppUser> => {
    if (!isSupabaseConfigured) {
      const isAdmin = checkIsAdmin(email);
      const user = createMockUser(email, undefined, isAdmin);
      setCurrentUser(user);
      saveMockUser(user);
      return user;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw error ?? new Error('Admin login failed');

    const appUser = await resolveAppUser(data.user);

    // コミュニティ未登録（申請すらしていない）の場合のみ throw
    // pending / rejected はそのまま返し、UI 側でハンドリング
    if (!appUser.isAdmin && !appUser.communityStatus) {
      await revokeSessionAfterAdminAccessDenied({
        signOut: () => supabase.auth.signOut({ scope: 'local' }),
        clearStoredCommunityId,
        clearCurrentUser: () => setCurrentUser(null),
        logSignOutFailure: (error) => {
          console.error('[AuthContext] adminLogin signOut after access denied failed', error);
        },
      });
      throw new AdminAccessDeniedError();
    }
    return appUser;
  }, []);

  // ===== 管理者サインアップ（コミュニティ登録申請）=====
  const adminSignUp = useCallback(async (
    email: string,
    password: string,
    communityName: string
  ): Promise<AppUser> => {
    if (!isSupabaseConfigured) {
      // モック環境では即時承認（テスト用）
      const user: AppUser = {
        uid: `admin-${Date.now()}`,
        email,
        displayName: communityName,
        isAdmin: true,
        communityName,
        communityStatus: 'approved',
      };
      setCurrentUser(user);
      saveMockUser(user);
      return user;
    }

    // 1. Supabase Auth でユーザー作成
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: communityName } },
    });
    if (error || !data.user) throw error ?? new Error('Sign up failed');

    // 2. communities テーブルに登録（status は DB デフォルトの 'pending'）
    const community = await createCommunity(data.user.id, communityName);
    if (!community) throw new Error('コミュニティの申請に失敗しました。');

    // 登録申請完了：isAdmin は false、status は 'pending'
    return {
      uid: data.user.id,
      email,
      displayName: communityName,
      isAdmin: false,
      communityName,
      communityStatus: 'pending',
    };
  }, []);

  // ===== ログアウト =====
  const logout = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured) {
      clearStoredCommunityId();
      setCurrentUser(null);
      clearMockUser();
      return;
    }

    // scope: 'local' でローカルセッションのみ削除（他タブへの影響を最小化し確実にログアウト）
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;

    // onAuthStateChange を待たずに UI を guest へ遷移させる（pending 表示の取り残し防止）
    clearStoredCommunityId();
    setCurrentUser(null);
  }, []);

  // ===== Google ログイン =====
  const loginWithGoogle = useCallback(async (_asAdmin = false): Promise<AppUser> => {
    if (!isSupabaseConfigured) {
      const user = createMockUser('google-user@example.com', 'google-user-demo', _asAdmin);
      setCurrentUser(user);
      saveMockUser(user);
      return user;
    }

    // OAuth 後に元のパス（/admin/login など）へ戻れるようにする
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
    // OAuth はリダイレクトなので、ここには到達しない
    return { uid: '', email: null, displayName: null, isAdmin: false };
  }, []);

  // ===== Facebook ログイン =====
  const loginWithFacebook = useCallback(async (): Promise<AppUser> => {
    if (!isSupabaseConfigured) {
      const user = createMockUser('facebook-user@example.com', 'facebook-user-demo');
      setCurrentUser(user);
      saveMockUser(user);
      return user;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return { uid: '', email: null, displayName: null, isAdmin: false };
  }, []);

  const refreshCommunitySlug = useCallback((newSlug: string) => {
    setCurrentUser((prev) => prev ? { ...prev, communitySlug: newSlug } : null);
  }, []);

  const value: AuthContextType = useMemo(() => ({
    currentUser,
    loading,
    isResolvingAuth,
    signUp,
    login,
    loginParticipant,
    adminLogin,
    adminSignUp,
    logout,
    loginWithGoogle,
    loginWithFacebook,
    refreshCommunitySlug,
  }), [
    currentUser,
    loading,
    isResolvingAuth,
    signUp,
    login,
    loginParticipant,
    adminLogin,
    adminSignUp,
    logout,
    loginWithGoogle,
    loginWithFacebook,
    refreshCommunitySlug,
  ]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        background: '#f9fafb',
      }} />
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export type { MockUser };
