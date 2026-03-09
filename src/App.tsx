import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from './core/hooks/useRouter';
import { HossiiProvider, useHossiiStore } from './core/hooks/useHossiiStore';
import { AuthProvider, useAuth } from './core/contexts/AuthContext';
import { AdminNavigationProvider } from './core/contexts/AdminNavigationContext';
import { PostScreen } from './components/PostScreen/PostScreen';
import { SpaceScreen } from './components/SpaceScreen/SpaceScreen';
import { CommentsScreen } from './components/CommentsScreen/CommentsScreen';
import { SpacesScreen } from './components/SpacesScreen/SpacesScreen';
import { CommunitiesScreen } from './components/CommunitiesScreen/CommunitiesScreen';
import { ProfileScreen } from './components/ProfileScreen/ProfileScreen';
import { MyLogsScreen } from './components/MyLogsScreen/MyLogsScreen';
import { AccountScreen } from './components/AccountScreen/AccountScreen';
import { SpaceSettingsScreen } from './components/SpaceSettingsScreen/SpaceSettingsScreen';
import { StampCardScreen } from './components/StampCardScreen/StampCardScreen';
import { ReflectionScreen } from './components/ReflectionScreen/ReflectionScreen';
import { StartScreen } from './components/StartScreen/StartScreen';
import { AdminLoginScreen } from './components/Auth/AdminLoginScreen';
import { GuestEntryScreen } from './components/Auth/GuestEntryScreen';
import { PrivateSpaceScreen } from './components/Auth/PrivateSpaceScreen';
import { OnboardingModal } from './components/Auth/OnboardingModal';
import { TutorialOverlay } from './components/Tutorial/TutorialOverlay';
import { NicknameModal } from './components/NicknameModal/NicknameModal';
import { BottomNavBar } from './components/Navigation/BottomNavBar';
import { DEFAULT_QUICK_EMOTIONS } from './core/types/space';
import { mockHossiis } from './demo/mockData';
import styles from './App.module.css';

const AppContent = () => {
  const { currentUser, isResolvingAuth, logout } = useAuth();
  const { screen, navigate } = useRouter();
  const { state, spacesLoadedFromSupabase, setActiveSpace, addSpace, hasNicknameForSpace } = useHossiiStore();
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [pendingSpaceId, setPendingSpaceId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userProfile, setUserProfile] = useState<{ userId: string; nickname: string } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [spaceURLNotFound, setSpaceURLNotFound] = useState(false);
  // 初回 URL スラッグ解決済みフラグ（スペース設定変更後に再トリガーされるのを防ぐ）
  const initialSlugHandledRef = useRef(false);

  // /s/[slug] パスかどうかを初回レンダー時に同期的に検出（フラッシュ防止）
  const isOnSlugPath = useMemo(
    () => /^\/s\/[a-z0-9]/.test(window.location.pathname),
    []
  );

  // /s/[slug] ゲスト入室フロー用 state
  // guestSpaceId: 未ログインで /s/[slug] にアクセスしたときのスペースID
  // isGuestMode: ゲストとして入室済み（ニックネーム入力完了後）
  // pendingLoginSlug: ゲストがログインを選択した後、ログイン完了後にリダイレクトするslug
  const [guestSpaceId, setGuestSpaceId] = useState<string | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [pendingLoginSlug, setPendingLoginSlug] = useState<string | null>(null);
  // isPrivate なスペースへの未ログインアクセス時に true になる
  const [guestSpaceIsPrivate, setGuestSpaceIsPrivate] = useState(false);

  // /admin/login パスを検出（pathname ベース）
  const [appRoute, setAppRoute] = useState<'admin-login' | 'default'>(() =>
    window.location.pathname === '/admin/login' ? 'admin-login' : 'default'
  );


  // 処理済みの spaceId を追跡（二重処理防止）
  const processedSpaceIdRef = useRef<string | null>(null);

  // /admin/login にいて管理者ログイン済みの場合は管理画面へ自動遷移
  useEffect(() => {
    if (appRoute !== 'admin-login') return;
    if (isResolvingAuth) return;
    if (!currentUser?.isAdmin) return;
    window.history.replaceState({}, '', '/');
    setAppRoute('default');
    navigate(currentUser.isSuperAdmin ? 'communities' : 'spaces');
  }, [appRoute, currentUser, isResolvingAuth, navigate]);

  // Check if user needs onboarding (new user without profile)
  // 管理者はオンボーディング不要（コミュニティ名が表示名を兼ねる）
  // isResolvingAuth 中は onAuthStateChange の非同期解決が完了していないためスキップ
  useEffect(() => {
    if (isResolvingAuth) return;
    if (currentUser && !currentUser.isAdmin && !userProfile && currentUser.communityStatus === undefined) {
      const hasProfile = localStorage.getItem(`profile_${currentUser.uid}`);
      if (!hasProfile) {
        setShowOnboarding(true);
      } else {
        const savedProfile = JSON.parse(hasProfile);
        setUserProfile(savedProfile);
      }
    }
  }, [currentUser, userProfile, isResolvingAuth]);

  // ログイン完了後にpendingLoginSlugへリダイレクト（ゲスト→ログイン引き継ぎ）
  useEffect(() => {
    if (currentUser && pendingLoginSlug) {
      // 現在のパスが /c/*/s/* 形式ならそのまま維持、そうでなければ /s/[slug] にリダイレクト
      const isCommunityPath = window.location.pathname.match(
        /^\/c\/([a-z0-9][a-z0-9-]*)\/s\/([a-z0-9][a-z0-9-]*)$/
      );
      window.location.href = isCommunityPath
        ? window.location.pathname
        : `/s/${pendingLoginSlug}`;
    }
  }, [currentUser, pendingLoginSlug]);

  // Check if user needs tutorial (first time user)
  useEffect(() => {
    if (currentUser && userProfile && !showOnboarding) {
      const tutorialSeen = localStorage.getItem(`hossii_tutorial_seen_${userProfile.userId}`);
      if (!tutorialSeen) {
        setShowTutorial(true);
      }
    }
  }, [currentUser, userProfile, showOnboarding]);

  // /c/[community-slug]/s/[space-slug] または /s/[slug] パスでスペースに直接アクセス
  useEffect(() => {
    const communitySpaceMatch = window.location.pathname.match(
      /^\/c\/([a-z0-9][a-z0-9-]*)\/s\/([a-z0-9][a-z0-9-]*)$/
    );
    const legacyMatch = window.location.pathname.match(
      /^\/s\/([a-z0-9][a-z0-9-]*[a-z0-9]?[a-z0-9]*)$/
    );

    const slug = communitySpaceMatch ? communitySpaceMatch[2] : legacyMatch?.[1];
    if (!slug) return;

    // 既に初回ナビゲーション処理済みの場合は再実行しない
    // （スペースのslug変更時に state.spaces が更新されても "not found" にならないよう防止）
    if (initialSlugHandledRef.current) return;

    // アクセス時のパスをそのまま保持する（/c/*/s/* 形式も維持）
    const originalPath = window.location.pathname;

    const targetSpace = state.spaces.find((s) => s.spaceURL === slug);

    if (targetSpace) {
      initialSlugHandledRef.current = true;
      // スペースが見つかった場合は "not found" をリセット
      setSpaceURLNotFound(false);

      if (currentUser) {
        // ログイン済み: そのまま入室
        setActiveSpace(targetSpace.id);
        if (!hasNicknameForSpace(targetSpace.id)) {
          setPendingSpaceId(targetSpace.id);
          setShowNicknameModal(true);
        }
        window.history.replaceState({}, '', originalPath);
        navigate('screen');
      } else {
        // 未ログイン: isPrivate なスペースはアクセス拒否
        if (!isGuestMode) {
          if (targetSpace.isPrivate) {
            setGuestSpaceIsPrivate(true);
          } else if (hasNicknameForSpace(targetSpace.id)) {
            // 過去に入室済み（ニックネームが localStorage に保存されている）→ そのまま入室
            setActiveSpace(targetSpace.id);
            setIsGuestMode(true);
            window.history.replaceState({}, '', originalPath);
            navigate('screen');
          } else {
            setGuestSpaceId(targetSpace.id);
          }
        }
      }
    } else if (spacesLoadedFromSupabase) {
      // Supabase からのスペース読み込みが完了した上で見つからない場合のみ "not found" にする
      setSpaceURLNotFound(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.spaces, currentUser, spacesLoadedFromSupabase]);

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
    // ログイン済み管理者は useEffect で自動遷移するまでローディング表示
    if (currentUser?.isAdmin || isResolvingAuth) {
      return (
        <div style={{
          minHeight: '100dvh',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
        }} />
      );
    }
    return (
      <AdminLoginScreen
        onLoginSuccess={(user) => {
          window.history.replaceState({}, '', '/');
          setAppRoute('default');
          navigate(user.isSuperAdmin ? 'communities' : 'spaces');
        }}
      />
    );
  }

  // 審査待ちユーザーが /admin/login 以外のルートにいる場合（セッション復元時等）
  if (currentUser && currentUser.communityStatus === 'pending') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100dvh', gap: '12px',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
        color: '#fff', fontFamily: 'sans-serif', textAlign: 'center', padding: '24px',
      }}>
        <div style={{ fontSize: '3rem' }}>⏳</div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>審査中です</h2>
        {currentUser.communityName && (
          <p style={{ fontSize: '0.95rem', color: '#a5b4fc', margin: 0 }}>
            「{currentUser.communityName}」
          </p>
        )}
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, margin: 0 }}>
          Hossii 運営チームが審査しています。<br />
          承認後にスペース管理画面が利用できます。
        </p>
        <button
          onClick={async () => {
            try { await logout(); } catch { /* ignore */ }
            window.location.href = '/admin/login';
          }}
          style={{
            marginTop: '8px', padding: '10px 24px', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.3)', background: 'transparent',
            color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', cursor: 'pointer',
          }}
        >
          ログアウト
        </button>
      </div>
    );
  }

  // 却下されたユーザー
  if (currentUser && currentUser.communityStatus === 'rejected') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100dvh', gap: '12px',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
        color: '#fff', fontFamily: 'sans-serif', textAlign: 'center', padding: '24px',
      }}>
        <div style={{ fontSize: '3rem' }}>❌</div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>申請が承認されませんでした</h2>
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, margin: 0 }}>
          ご不明な点はお問い合わせください。
        </p>
        <button
          onClick={async () => {
            try { await logout(); } catch { /* ignore */ }
            window.location.href = '/admin/login';
          }}
          style={{
            marginTop: '8px', padding: '10px 24px', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.3)', background: 'transparent',
            color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', cursor: 'pointer',
          }}
        >
          ログアウト
        </button>
      </div>
    );
  }

  // /s/[slug] アクセス: 未ログインかつ isPrivate なスペース → アクセス拒否画面
  if (!currentUser && guestSpaceIsPrivate) {
    return (
      <PrivateSpaceScreen
        onLoginRequested={() => {
          setGuestSpaceIsPrivate(false);
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
          const guestSpace = state.spaces.find((s) => s.id === guestSpaceId);
          const slugForGuest = guestSpace?.spaceURL;
          window.history.replaceState({}, '', slugForGuest ? `/s/${slugForGuest}` : '/');
          navigate('screen');
        }}
        onLoginRequested={() => {
          // ログイン選択 → slug を保存してから StartScreen へ
          const guestSpace = state.spaces.find((s) => s.id === guestSpaceId);
          if (guestSpace?.spaceURL) {
            setPendingLoginSlug(guestSpace.spaceURL);
          }
          setGuestSpaceId(null);
        }}
      />
    );
  }

  // /s/[slug] アクセス中にスペースがまだ解決されていない間は空白を表示
  // GuestEntryScreen と同じ背景色にすることでフラッシュを防ぐ
  if (!currentUser && !isGuestMode && isOnSlugPath && !guestSpaceId && !guestSpaceIsPrivate && !spaceURLNotFound) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'linear-gradient(150deg, #ede9fe 0%, #f5f3ff 40%, #fce7f3 100%)',
      }} />
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
      case 'communities':
        return <CommunitiesScreen />;
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
      case 'reflection':
        return <ReflectionScreen />;
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
      <AdminNavigationProvider>
        <HossiiProvider initialHossiis={mockHossiis}>
          <AppContent />
        </HossiiProvider>
      </AdminNavigationProvider>
    </AuthProvider>
  );
};

export default App;
