import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

// Mock User type (similar to Firebase User but simplified)
export type MockUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
};

type AuthContextType = {
  currentUser: MockUser | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<MockUser>;
  login: (email: string, password: string) => Promise<MockUser>;
  adminLogin: (email: string, password: string) => Promise<MockUser>;
  adminSignUp: (email: string, password: string, communityName: string) => Promise<MockUser>;
  logout: () => Promise<void>;
  loginWithGoogle: (asAdmin?: boolean) => Promise<MockUser>;
  loginWithFacebook: () => Promise<MockUser>;
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

// localStorage key for mock authentication
const MOCK_AUTH_KEY = 'mock_auth_user';

// Helper to create a mock user
const createMockUser = (email: string, uid?: string, isAdmin = false): MockUser => {
  return {
    uid: uid || `user-${Date.now()}`,
    email,
    displayName: email.split('@')[0] || 'Demo User',
    isAdmin,
  };
};

// Mock admin check: email containing "admin" is treated as admin
// Future: replace with app_metadata.role === "admin" from Supabase
const checkIsAdmin = (email: string): boolean => {
  return email.toLowerCase().includes('admin');
};

// Helper to save user to localStorage
const saveMockUser = (user: MockUser) => {
  localStorage.setItem(MOCK_AUTH_KEY, JSON.stringify(user));
};

// Helper to load user from localStorage
const loadMockUser = (): MockUser | null => {
  const stored = localStorage.getItem(MOCK_AUTH_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

// Helper to clear user from localStorage
const clearMockUser = () => {
  localStorage.removeItem(MOCK_AUTH_KEY);
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const user = loadMockUser();
    setCurrentUser(user);
    setLoading(false);
  }, []);

  // Sign up with email and password (MOCK)
  const signUp = async (email: string, _password: string): Promise<MockUser> => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const user = createMockUser(email);
    setCurrentUser(user);
    saveMockUser(user);

    return user;
  };

  // Login with email and password (MOCK - participant login, isAdmin always false)
  const login = async (email: string, _password: string): Promise<MockUser> => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const user = createMockUser(email);
    setCurrentUser(user);
    saveMockUser(user);

    return user;
  };

  // Admin login with email and password (MOCK - checks admin role)
  // Future: use supabase.auth.signInWithPassword() then check app_metadata.role
  const adminLogin = async (email: string, _password: string): Promise<MockUser> => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const isAdmin = checkIsAdmin(email);
    const user = createMockUser(email, undefined, isAdmin);
    setCurrentUser(user);
    saveMockUser(user);

    return user;
  };

  // Admin sign up with email and password (MOCK - creates admin user)
  // communityName is stored in displayName for now
  // Future: use supabase.auth.signUp() then set app_metadata.role = "admin" via service role
  const adminSignUp = async (email: string, _password: string, communityName: string): Promise<MockUser> => {
    await new Promise((resolve) => setTimeout(resolve, 600));

    const user: MockUser = {
      uid: `admin-${Date.now()}`,
      email,
      displayName: communityName,
      isAdmin: true,
    };
    setCurrentUser(user);
    saveMockUser(user);

    return user;
  };

  // Logout (MOCK)
  const logout = async (): Promise<void> => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    setCurrentUser(null);
    clearMockUser();
  };

  // Login with Google (MOCK)
  // asAdmin: true when called from AdminLoginScreen
  const loginWithGoogle = async (asAdmin = false): Promise<MockUser> => {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const user = createMockUser('google-user@example.com', 'google-user-demo', asAdmin);
    setCurrentUser(user);
    saveMockUser(user);

    return user;
  };

  // Login with Facebook (MOCK)
  const loginWithFacebook = async (): Promise<MockUser> => {
    // Simulate OAuth flow delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const user = createMockUser('facebook-user@example.com', 'facebook-user-demo');
    setCurrentUser(user);
    saveMockUser(user);

    return user;
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

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
