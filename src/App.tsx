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
import { OnboardingModal } from './components/Auth/OnboardingModal';
import { TutorialOverlay } from './components/Tutorial/TutorialOverlay';
import { NicknameModal } from './components/NicknameModal/NicknameModal';
import { BottomNavBar } from './components/Navigation/BottomNavBar';
import { DEFAULT_QUICK_EMOTIONS } from './core/types/space';
import { mockHossiis } from './demo/mockData';
import styles from './App.module.css';

const AppContent = () => {
  const { currentUser } = useAuth();
  const { screen } = useRouter();
  const { state, setActiveSpace, addSpace, hasNicknameForSpace } = useHossiiStore();
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [pendingSpaceId, setPendingSpaceId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userProfile, setUserProfile] = useState<{ userId: string; nickname: string } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [spaceURLNotFound, setSpaceURLNotFound] = useState(false);

  // 処理済みの spaceId を追跡（二重処理防止）
  const processedSpaceIdRef = useRef<string | null>(null);

  // Check if user needs onboarding (new user without profile)
  useEffect(() => {
    if (currentUser && !userProfile) {
      // TODO: Check Firestore for existing profile
      // For now, show onboarding for all new users
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
      setActiveSpace(targetSpace.id);
      // ニックネーム未設定ならモーダル表示
      if (!hasNicknameForSpace(targetSpace.id)) {
        setPendingSpaceId(targetSpace.id);
        setShowNicknameModal(true);
      }
      // パスをクリアしてハッシュベースのスペース画面へ
      window.history.replaceState({}, '', '/#screen');
    } else {
      setSpaceURLNotFound(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.spaces]);

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

  // Show start screen if not authenticated
  if (!currentUser) {
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
