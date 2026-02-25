import { useEffect, useState, useRef } from 'react';
import { useRouter } from './core/hooks/useRouter';
import { HossiiProvider, useHossiiStore } from './core/hooks/useHossiiStore';
import { AuthProvider, useAuth } from './core/contexts/AuthContext';
import { PostScreen } from './components/PostScreen/PostScreen';
import { SpaceScreen } from './components/SpaceScreen/SpaceScreen';
import { CommentsScreen } from './components/CommentsScreen/CommentsScreen';
import { SpacesScreen } from './components/SpacesScreen/SpacesScreen';
import { ProfileScreen } from './components/ProfileScreen/ProfileScreen';
import { MyLogsScreen } from './components/MyLogsScreen/MyLogsScreen';
import { AccountScreen } from './components/AccountScreen/AccountScreen';
import { SpaceSettingsScreen } from './components/SpaceSettingsScreen/SpaceSettingsScreen';
import { StampCardScreen } from './components/StampCardScreen/StampCardScreen';
import { StartScreen } from './components/StartScreen/StartScreen';
import { AdminLoginScreen } from './components/Auth/AdminLoginScreen';
import { GuestEntryScreen } from './components/Auth/GuestEntryScreen';
import { OnboardingModal } from './components/Auth/OnboardingModal';
import { TutorialOverlay } from './components/Tutorial/TutorialOverlay';
import { NicknameModal } from './components/NicknameModal/NicknameModal';
import { BottomNavBar } from './components/Navigation/BottomNavBar';
import { DEFAULT_QUICK_EMOTIONS } from './core/types/space';
import { mockHossiis } from './demo/mockData';
import styles from './App.module.css';

const AppContent = () => {
  const { currentUser } = useAuth();
  const { screen, navigate } = useRouter();
  const { state, setActiveSpace, addSpace, hasNicknameForSpace } = useHossiiStore();
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [pendingSpaceId, setPendingSpaceId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userProfile, setUserProfile] = useState<{ userId: string; nickname: string } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [spaceURLNotFound, setSpaceURLNotFound] = useState(false);

  // /s/[slug] ゲスト入室フロー用 state
  // guestSpaceId: 未ログインで /s/[slug] にアクセスしたときのスペースID
  // isGuestMode: ゲストとして入室済み（ニックネーム入力完了後）
  const [guestSpaceId, setGuestSpaceId] = useState<string | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);

  // /admin/login パスを検出（pathname ベース）
  const [appRoute, setAppRoute] = useState<'admin-login' | 'default'>(() =>
    window.location.pathname === '/admin/login' ? 'admin-login' : 'default'
  );

  // 管理者ログイン済みで /admin/login にアクセスした場合は useEffect でリダイレクト
  useEffect(() => {
    if (appRoute === 'admin-login' && currentUser?.isAdmin) {
      window.history.replaceState({}, '', '/');
      navigate('spaces');
      setAppRoute('default');
    }
  }, [appRoute, currentUser, navigate]);

  // 処理済みの spaceId を追跡（二重処理防止）
  const processedSpaceIdRef = useRef<string | null>(null);

  // Check if user needs onboarding (new user without profile)
  // 管理者はオンボーディング不要（コミュニティ名が表示名を兼ねる）
  useEffect(() => {
    if (currentUser && !currentUser.isAdmin && !userProfile) {
      const hasProfile = localStorage.getItem(`profile_${currentUser.uid}`);
      if (!hasProfile) {
        setShowOnboarding(true);
      } else {
        const savedProfile = JSON.parse(hasProfile);
        setUserProfile(savedProfile);
      }
    }
  }, [currentUser, userProfile]);

  // Check if user needs tutorial (first time user)
  useEffect(() => {
    if (currentUser && userProfile && !showOnboarding) {
      const tutorialSeen = localStorage.getItem(`hossii_tutorial_seen_${userProfile.userId}`);
      if (!tutorialSeen) {
        setShowTutorial(true);
      }
    }
  }, [currentUser, userProfile, showOnboarding]);

  // /s/[slug] パスでスペースに直接アクセス
  useEffect(() => {
    const match = window.location.pathname.match(/^\/s\/([a-z0-9][a-z0-9-]*[a-z0-9]?[a-z0-9]*)$/);
    if (!match) return;

    const slug = match[1];
    const targetSpace = state.spaces.find((s) => s.spaceURL === slug);

    if (targetSpace) {
      // スペースが見つかった場合は "not found" をリセット
      setSpaceURLNotFound(false);

      if (currentUser) {
        // ログイン済み: そのまま入室
        setActiveSpace(targetSpace.id);
        if (!hasNicknameForSpace(targetSpace.id)) {
          setPendingSpaceId(targetSpace.id);
          setShowNicknameModal(true);
        }
        window.history.replaceState({}, '', '/#screen');
      } else {
        // 未ログイン: ゲスト入室画面を表示（isGuestMode でなければ）
        if (!isGuestMode) {
          setGuestSpaceId(targetSpace.id);
        }
      }
    } else if (state.spaces.length > 0) {
      // スペースが読み込まれた上で見つからない場合のみ "not found" にする
      setSpaceURLNotFound(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.spaces, currentUser]);

  // ?space=xxx でスペースを切り替え（招待リンク対応）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spaceId = params.get('space');
    if (!spaceId) return;

    // 既に同じ spaceId を処理済みならスキップ
    if (processedSpaceIdRef.current === spaceId) return;
    processedSpaceIdRef.current = spaceId;

    const existingSpace = state.spaces.find((f) => f.id === spaceId);
    if (existingSpace) {
      // スペースが存在する場合
      setActiveSpace(spaceId);
      // ニックネーム未設定ならモーダル表示
      if (!hasNicknameForSpace(spaceId)) {
        setPendingSpaceId(spaceId);
        setShowNicknameModal(true);
      }
    } else {
      // スペースが存在しない場合は追加
      addSpace({
        id: spaceId,
        name: '共有されたスペース',
        cardType: 'constellation',
        quickEmotions: DEFAULT_QUICK_EMOTIONS,
        createdAt: new Date(),
      });
      setActiveSpace(spaceId);
      // ニックネーム入力モーダルを表示
      setPendingSpaceId(spaceId);
      setShowNicknameModal(true);
    }
    // URLパラメータをクリア
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
  }, [state.spaces, setActiveSpace, addSpace, hasNicknameForSpace]);

  const handleNicknameModalClose = () => {
    setShowNicknameModal(false);
    setPendingSpaceId(null);
  };

  const handleOnboardingComplete = (userId: string, nickname: string) => {
    if (!currentUser) return;

    const profile = { userId, nickname };
    setUserProfile(profile);
    setShowOnboarding(false);

    // Save to localStorage (TODO: Save to Firestore)
    localStorage.setItem(`profile_${currentUser.uid}`, JSON.stringify(profile));
  };

  // /s/[slug] にアクセスしたがスペースが見つからない場合
  if (spaceURLNotFound) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        gap: '16px',
        color: '#6b7280',
        fontFamily: 'sans-serif',
      }}>
        <div style={{ fontSize: '48px' }}>🔍</div>
        <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: 0 }}>
          スペースが見つかりません
        </h1>
        <p style={{ fontSize: '14px', margin: 0 }}>
          このURLのスペースは存在しないか、削除された可能性があります。
        </p>
        <button
          onClick={() => {
            setSpaceURLNotFound(false);
            window.history.replaceState({}, '', '/');
          }}
          style={{
            marginTop: '8px',
            padding: '10px 24px',
            borderRadius: '8px',
            border: 'none',
            background: '#6366f1',
            color: '#fff',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          トップへ戻る
        </button>
      </div>
    );
  }

  // /admin/login パスの場合: 管理者ログイン画面を表示
  if (appRoute === 'admin-login') {
    if (currentUser?.isAdmin) {
      // useEffect でリダイレクト中 → 一時的に何も表示しない（すぐに遷移する）
      return null;
    }
    return (
      <AdminLoginScreen
        onLoginSuccess={() => {
          window.history.replaceState({}, '', '/');
          setAppRoute('default');
          navigate('spaces');
        }}
      />
    );
  }

  // /s/[slug] アクセス: 未ログインかつゲスト入室前 → ゲスト入室画面
  if (!currentUser && guestSpaceId && !isGuestMode) {
    return (
      <GuestEntryScreen
        spaceId={guestSpaceId}
        onEnterAsGuest={() => {
          setActiveSpace(guestSpaceId);
          setIsGuestMode(true);
          window.history.replaceState({}, '', '/#screen');
          navigate('screen');
        }}
        onLoginRequested={() => {
          // ログイン選択 → guestSpaceId をクリアして StartScreen（ログイン画面）へ
          setGuestSpaceId(null);
        }}
      />
    );
  }

  // Show start screen if not authenticated (guest mode でない場合)
  if (!currentUser && !isGuestMode) {
    return <StartScreen />;
  }

  // Show onboarding if authenticated but no profile
  if (showOnboarding) {
    return <OnboardingModal onComplete={handleOnboardingComplete} />;
  }

  const handleTutorialComplete = () => {
    setShowTutorial(false);
  };

  const renderScreen = () => {
    switch (screen) {
      case 'post':
        return <PostScreen />;
      case 'screen':
        return <SpaceScreen />;
      case 'comments':
        return <CommentsScreen />;
      case 'spaces':
        return <SpacesScreen />;
      case 'profile':
        return <ProfileScreen />;
      case 'mylogs':
        return <MyLogsScreen />;
      case 'account':
        return <AccountScreen />;
      case 'settings':
        return <SpaceSettingsScreen />;
      case 'card':
        return <StampCardScreen />;
      default:
        return <SpaceScreen />;
    }
  };

  return (
    <div className={styles.appRoot} data-scale={state.displayScale}>
      {renderScreen()}
      {showNicknameModal && pendingSpaceId && (
        <NicknameModal
          spaceId={pendingSpaceId}
          onClose={handleNicknameModalClose}
        />
      )}
      <BottomNavBar />
      {showTutorial && userProfile && (
        <TutorialOverlay
          userId={userProfile.userId}
          onComplete={handleTutorialComplete}
        />
      )}
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <HossiiProvider initialHossiis={mockHossiis}>
        <AppContent />
      </HossiiProvider>
    </AuthProvider>
  );
};

export default App;
