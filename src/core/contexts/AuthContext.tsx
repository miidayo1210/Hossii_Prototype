import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../supabase';
import { getAdminCommunity, createCommunity } from '../utils/communitiesApi';
import type { CommunityStatus } from '../utils/communitiesApi';

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
  communityName?: string;
  communityStatus?: CommunityStatus;
};

type AuthContextType = {
  currentUser: AppUser | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<AppUser>;
  login: (email: string, password: string) => Promise<AppUser>;
  adminLogin: (email: string, password: string) => Promise<AppUser>;
  adminSignUp: (email: string, password: string, communityName: string) => Promise<AppUser>;
  logout: () => Promise<void>;
  loginWithGoogle: (asAdmin?: boolean) => Promise<AppUser>;
  loginWithFacebook: () => Promise<AppUser>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

type AuthProviderProps = {
  children: ReactNode;
};

/**
 * Supabase User → AppUser（非同期: communities テーブルで管理者チェック）
 * app_metadata.role = "admin" は承認済みとして扱う（Supabase Dashboard で手動設定した場合）
 * communities.status が 'approved' のときのみ isAdmin: true
 */
async function resolveAppUser(user: User): Promise<AppUser> {
  const roleFromMetadata = user.app_metadata?.role as string | undefined;
  const displayName = user.user_metadata?.display_name as string | null ?? null;

  // app_metadata.role = "admin" は承認済みとして扱う
  if (roleFromMetadata === 'admin') {
    return {
      uid: user.id,
      email: user.email ?? null,
      displayName,
      isAdmin: true,
      communityStatus: 'approved',
    };
  }

  // communities テーブルで管理者チェック・ステータス確認
  const community = await getAdminCommunity(user.id);
  if (!community) {
    return { uid: user.id, email: user.email ?? null, displayName, isAdmin: false };
  }

  return {
    uid: user.id,
    email: user.email ?? null,
    displayName: displayName ?? community.name ?? null,
    isAdmin: community.status === 'approved',
    communityName: community.name,
    communityStatus: community.status,
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
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // ===== セッション初期化 =====
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCurrentUser(loadMockUser());
      setLoading(false);
      return;
    }

    // 既存セッションを取得して管理者チェック
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (session) {
          const appUser = await resolveAppUser(session.user);
          setCurrentUser(appUser);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('[AuthContext] getSession error:', err);
        setLoading(false);
      });

    // 認証状態の変化を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: string, session: Session | null) => {
        if (session) {
          const appUser = await resolveAppUser(session.user);
          setCurrentUser(appUser);
        } else {
          setCurrentUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ===== 参加者サインアップ =====
  const signUp = async (email: string, password: string): Promise<AppUser> => {
    if (!isSupabaseConfigured) {
      const user = createMockUser(email);
      setCurrentUser(user);
      saveMockUser(user);
      return user;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) throw error ?? new Error('Sign up failed');
    return resolveAppUser(data.user);
  };

  // ===== 参加者ログイン =====
  const login = async (email: string, password: string): Promise<AppUser> => {
    if (!isSupabaseConfigured) {
      const user = createMockUser(email);
      setCurrentUser(user);
      saveMockUser(user);
      return user;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw error ?? new Error('Login failed');
    return resolveAppUser(data.user);
  };

  // ===== 管理者ログイン =====
  const adminLogin = async (email: string, password: string): Promise<AppUser> => {
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
      throw new Error('管理者権限がありません。コミュニティ登録が必要です。');
    }
    return appUser;
  };

  // ===== 管理者サインアップ（コミュニティ登録申請）=====
  const adminSignUp = async (
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
  };

  // ===== ログアウト =====
  const logout = async (): Promise<void> => {
    if (!isSupabaseConfigured) {
      setCurrentUser(null);
      clearMockUser();
      return;
    }

    // scope: 'local' でローカルセッションのみ削除（他タブへの影響を最小化し確実にログアウト）
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  };

  // ===== Google ログイン =====
  const loginWithGoogle = async (_asAdmin = false): Promise<AppUser> => {
    if (!isSupabaseConfigured) {
      const user = createMockUser('google-user@example.com', 'google-user-demo', _asAdmin);
      setCurrentUser(user);
      saveMockUser(user);
      return user;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    // OAuth はリダイレクトなので、ここには到達しない
    return { uid: '', email: null, displayName: null, isAdmin: false };
  };

  // ===== Facebook ログイン =====
  const loginWithFacebook = async (): Promise<AppUser> => {
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
  };

  const value: AuthContextType = {
    currentUser,
    loading,
    signUp,
    login,
    adminLogin,
    adminSignUp,
    logout,
    loginWithGoogle,
    loginWithFacebook,
  };

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
