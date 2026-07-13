import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from './core/hooks/useRouter';
import { useMediaQuery } from './core/hooks/useMediaQuery';
import { HossiiProvider } from './core/hooks/HossiiStoreProvider';
import { SpacePaneProvider } from './core/hooks/SpacePaneProvider';
import { useHossiiStore } from './core/hooks/useHossiiStore';
import { fetchSpaceByUrl } from './core/utils/spacesApi';
import { resolveSpaceSlug } from './core/utils/resolveSpaceSlug';
import { isSupabaseConfigured, supabaseEnvironmentValidation } from './core/supabase';
import { AuthProvider } from './core/contexts/AuthContext';
import { useAuth } from './core/contexts/useAuth';
import { AdminNavigationProvider } from './core/contexts/AdminNavigationContext';
import { DisplayPrefsProvider } from './core/contexts/DisplayPrefsContext';
import { PostScreen } from './components/PostScreen/PostScreen';
import { SpaceScreen, type SpaceScreenHandle } from './components/SpaceScreen/SpaceScreen';
import { CommentsScreen } from './components/CommentsScreen/CommentsScreen';
import { SpacesScreen } from './components/SpacesScreen/SpacesScreen';
import { CommunitiesScreen } from './components/CommunitiesScreen/CommunitiesScreen';
import { ProfileScreen } from './components/ProfileScreen/ProfileScreen';
import { MyLogsScreen } from './components/MyLogsScreen/MyLogsScreen';
import { AccountScreen } from './components/AccountScreen/AccountScreen';
import { SpaceSettingsScreen } from './components/SpaceSettingsScreen/SpaceSettingsScreen';
import { StampCardScreen } from './components/StampCardScreen/StampCardScreen';
import { ReflectionScreen } from './components/ReflectionScreen/ReflectionScreen';
import { NeighborsScreen } from './components/NeighborsScreen/NeighborsScreen';
import { StartScreen } from './components/StartScreen/StartScreen';
import { AdminLoginScreen } from './components/Auth/AdminLoginScreen';
import { LoginScreen } from './components/Auth/LoginScreen';
import { ParticipantLoginScreen } from './components/Auth/ParticipantLoginScreen';
import { GuestEntryScreen } from './components/Auth/GuestEntryScreen';
import { PrivateSpaceScreen } from './components/Auth/PrivateSpaceScreen';
import { OnboardingModal } from './components/Auth/OnboardingModal';
import { TutorialOverlay } from './components/Tutorial/TutorialOverlay';
import { NicknameModal } from './components/NicknameModal/NicknameModal';
import { BottomNavBar } from './components/Navigation/BottomNavBar';
import { DEFAULT_QUICK_EMOTIONS } from './core/types/space';
import { mockHossiis } from './demo/mockData';
import styles from './App.module.css';
import { ScaledContent } from './components/ScaledContent/ScaledContent';
import { GlobalClickStarBurst } from './components/GlobalClickStarBurst/GlobalClickStarBurst';
import { HossiiToast } from './core/ui/HossiiToast';
import { DevelopmentBanner } from './components/DevelopmentBanner/DevelopmentBanner';
import { SupabaseConfigError } from './components/SupabaseConfigError/SupabaseConfigError';

// /c/.../s/... および /s/... の URL スラッグ: 英数字の塊をハイフンでつなぐだけにし、末尾・連続ハイフンを禁止
const URL_PATH_SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';
const RE_PATH_COMMUNITY_AND_SPACE = new RegExp(
  `^\\/c\\/(${URL_PATH_SLUG})\\/s\\/(${URL_PATH_SLUG})$`
);
const RE_PATH_LEGACY_SPACE = new RegExp(`^\\/s\\/(${URL_PATH_SLUG})$`);
const RE_IS_SLUG_URL_PATH = new RegExp(
  `^\\/c\\/${URL_PATH_SLUG}\\/s\\/${URL_PATH_SLUG}$|^\\/s\\/${URL_PATH_SLUG}$`
);

const authResolvingScreenStyle = {
  minHeight: '100dvh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(150deg, #ede9fe 0%, #f5f3ff 40%, #fce7f3 100%)',
  color: '#6b7280',
  fontFamily: 'sans-serif',
  fontSize: '14px',
} as const;

const AppContent = () => {
  const { currentUser, isResolvingAuth, logout } = useAuth();
  const { screen, navigate } = useRouter();
  const { state, spacesLoadedFromSupabase, setActiveSpace, addSpace, addSpaceLocal, hasNicknameForSpace } = useHossiiStore();
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [pendingSpaceId, setPendingSpaceId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [visitingToast, setVisitingToast] = useState(false);
  const [userProfile, setUserProfile] = useState<{ userId: string; nickname: string } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [pendingQuickPostOpen, setPendingQuickPostOpen] = useState(false);
  const spaceScreenRef = useRef<SpaceScreenHandle>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [spaceURLNotFound, setSpaceURLNotFound] = useState(false);
  // slug 直リンクの単体取得結果。loading 中は not-found にしない。
  // hit 後も addSpaceLocal の state 反映前に effect が走るため、empty だけでは判定しない。
  type SlugFetchOutcome = 'idle' | 'loading' | 'hit' | 'miss';
  const [slugFetchOutcome, setSlugFetchOutcome] = useState<SlugFetchOutcome>(() => {
    const path = window.location.pathname;
    if (!isSupabaseConfigured || !RE_IS_SLUG_URL_PATH.test(path)) return 'idle';
    return 'loading';
  });
  // 初回 URL スラッグ解決済みフラグ（スペース設定変更後に再トリガーされるのを防ぐ）
  const initialSlugHandledRef = useRef(false);

  // スペース直リンクの pathname か。replaceState で / に戻ったあとに古い true のまま残さないよう毎レンダーで評価（下の effect と同じ判定）
  const p = window.location.pathname;
  const isOnSlugPath = RE_IS_SLUG_URL_PATH.test(p);

  // /s/[slug] ゲスト入室フロー用 state
  // guestSpaceId: 未ログインで /s/[slug] にアクセスしたときのスペースID
  // isGuestMode: ゲストとして入室済み（ニックネーム入力完了後）
  // pendingLoginSlug: ゲストがログイン/新規登録を選択した後、完了後にリダイレクトするslug
  // pendingAuthMode: ログイン画面の初期モード（login / signup）
  const [guestSpaceId, setGuestSpaceId] = useState<string | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [pendingLoginSlug, setPendingLoginSlug] = useState<string | null>(null);
  const [pendingAuthMode, setPendingAuthMode] = useState<'login' | 'signup'>('login');
  const [pendingParticipantSpaceId, setPendingParticipantSpaceId] = useState<string | null>(null);

  // ゲスト入室中に AccountScreen から参加者ログインを要求されたとき
  const handleParticipantLoginRequested = () => {
    // URL 直リンクの guestSpaceId を優先（localStorage の activeSpaceId が別スペースのまま残ることがある）
    const spaceId = guestSpaceId || state.activeSpaceId;
    if (spaceId) {
      setPendingParticipantSpaceId(spaceId);
    }
  };

  // ゲスト入室中に AccountScreen からログイン/新規登録を要求されたとき
  const handleGuestAuthRequested = (mode: 'login' | 'signup') => {
    const activeSpace = state.spaces.find((s) => s.id === state.activeSpaceId);
    if (activeSpace?.spaceURL) {
      setPendingLoginSlug(activeSpace.spaceURL);
    }
    setPendingAuthMode(mode);
  };
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
    if (currentUser?.username?.trim()) return;
    if (currentUser && !currentUser.isAdmin && !currentUser.isIssuedParticipant && !userProfile && currentUser.communityStatus === undefined) {
      const hasProfile = localStorage.getItem(`profile_${currentUser.uid}`);
      if (!hasProfile) {
        setShowOnboarding(true);
      } else {
        const savedProfile = JSON.parse(hasProfile);
        setUserProfile(savedProfile);
      }
    }
  }, [currentUser, userProfile, isResolvingAuth]);

  // ログイン済みになったらゲストモードを解除（localStorage のゲスト名を優先しない）
  useEffect(() => {
    if (currentUser) {
      setIsGuestMode(false);
    }
  }, [currentUser]);

  // 参加者ログイン成功後: ログイン対象スペースへ必ず入室する
  useEffect(() => {
    if (!currentUser || !pendingParticipantSpaceId) return;

    const spaceId = pendingParticipantSpaceId;
    setPendingParticipantSpaceId(null);
    setIsGuestMode(false);
    setActiveSpace(spaceId);
    if (!hasNicknameForSpace(spaceId)) {
      setPendingSpaceId(spaceId);
      setShowNicknameModal(true);
    }
    navigate('screen');
  }, [currentUser, pendingParticipantSpaceId, setActiveSpace, hasNicknameForSpace, navigate]);

  // ログイン/新規登録完了後にpendingLoginSlugへリダイレクト
  useEffect(() => {
    if (currentUser && pendingLoginSlug) {
      const slug = pendingLoginSlug;
      setPendingLoginSlug(null);
      setPendingAuthMode('login');
      // 現在のパスが /c/*/s/* 形式ならそのまま維持、そうでなければ /s/[slug] にリダイレクト
      const isCommunityPath = window.location.pathname.match(RE_PATH_COMMUNITY_AND_SPACE);
      window.location.href = isCommunityPath
        ? window.location.pathname
        : `/s/${slug}`;
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

  // ===== URL スラッグ ファストパス =====
  // fetchSpaces（全件取得）の完了を待たずに、スラッグで1件だけ直接取得して state にマージする。
  // キャッシュがあっても常に Revalidate し、Supabase を正とする（82）。
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSlugFetchOutcome('idle');
      return;
    }

    const communitySpaceMatch = window.location.pathname.match(RE_PATH_COMMUNITY_AND_SPACE);
    const legacyMatch = window.location.pathname.match(RE_PATH_LEGACY_SPACE);
    const slug = communitySpaceMatch ? communitySpaceMatch[2] : legacyMatch?.[1];
    if (!slug) {
      setSlugFetchOutcome('idle');
      return;
    }

    // Stale-while-revalidate: キャッシュがあっても常に fetchSpaceByUrl で再検証する
    const cached = state.spaces.find((s) => s.spaceURL === slug);
    if (cached) {
      setSlugFetchOutcome('hit');
    }

    fetchSpaceByUrl(slug).then((space) => {
      if (space) {
        addSpaceLocal(space);
        setSlugFetchOutcome('hit');
      } else {
        setSlugFetchOutcome(cached ? 'hit' : 'miss');
      }
    });
  // マウント時に1回だけ実行。state.spaces はマウント時点で localStorage から同期済み。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // /c/[community-slug]/s/[space-slug] または /s/[slug] パスでスペースに直接アクセス
  useEffect(() => {
    const communitySpaceMatch = window.location.pathname.match(RE_PATH_COMMUNITY_AND_SPACE);
    const legacyMatch = window.location.pathname.match(RE_PATH_LEGACY_SPACE);

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
            setGuestSpaceId(targetSpace.id);
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
      // Supabase あり: 単体取得が miss のときだけ not-found
      // loading 中や hit 直後の state 反映待ちでは出さない
      const shouldShowNotFound = isSupabaseConfigured
        ? slugFetchOutcome === 'miss'
        : true;
      if (shouldShowNotFound) {
        setSpaceURLNotFound(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.spaces, currentUser, spacesLoadedFromSupabase, slugFetchOutcome]);

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

  const handlePendingQuickPostConsumed = useCallback(() => {
    setPendingQuickPostOpen(false);
  }, []);

  const handleMobilePostNav = useCallback(() => {
    if (state.visitingSpaceId !== null) {
      setVisitingToast(true);
      return;
    }
    if (screen === 'screen') {
      spaceScreenRef.current?.toggleQuickPost();
      return;
    }
    setPendingQuickPostOpen(true);
    navigate('screen');
  }, [screen, navigate, state.visitingSpaceId]);

  const renderSpaceScreen = () => (
    <SpaceScreen
      ref={spaceScreenRef}
      pendingQuickPostOpen={pendingQuickPostOpen}
      onPendingQuickPostConsumed={handlePendingQuickPostConsumed}
    />
  );

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

  // 参加者ログイン画面（GuestEntryScreen より先に判定する）
  if (!currentUser && !isResolvingAuth && pendingParticipantSpaceId) {
    return (
      <ParticipantLoginScreen
        spaceId={pendingParticipantSpaceId}
        onClose={() => setPendingParticipantSpaceId(null)}
        onEmailLogin={() => {
          // 参加者ログイン → メールログイン（既存 LoginScreen）へ切り替える。
          // 戻り先スペースは既存の pendingLoginSlug 経路を再利用し、成功後に /s/[slug] へ戻す。
          const slug = resolveSpaceSlug({
            spaceId: pendingParticipantSpaceId,
            spaces: state.spaces,
            pathname: window.location.pathname,
          });
          setPendingParticipantSpaceId(null);
          if (slug) setPendingLoginSlug(slug);
        }}
      />
    );
  }

  // /s/[slug] アクセス: 未ログインかつ isPrivate なスペース → アクセス拒否画面
  if (!currentUser && !isResolvingAuth && guestSpaceIsPrivate) {
    return (
      <PrivateSpaceScreen
        onLoginRequested={() => {
          setGuestSpaceIsPrivate(false);
          if (guestSpaceId) {
            setPendingParticipantSpaceId(guestSpaceId);
          }
        }}
      />
    );
  }

  // /s/[slug] アクセス: 未ログインかつゲスト入室前 → ゲスト入室画面
  // pendingLoginSlug が立っている（＝メールログインへ切り替え中）ときは
  // 下の LoginScreen を優先させるため、ここでは表示しない。
  if (!currentUser && !isResolvingAuth && guestSpaceId && !isGuestMode && !pendingLoginSlug) {
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
        onLoginRequested={() => setPendingParticipantSpaceId(guestSpaceId)}
      />
    );
  }

  // ログイン/新規登録が選択された後 → LoginScreen を表示（ゲストモード中も含む）
  if (!currentUser && !isResolvingAuth && pendingLoginSlug) {
    return (
      <LoginScreen
        initialMode={pendingAuthMode}
        onClose={() => {
          setPendingLoginSlug(null);
          setPendingAuthMode('login');
        }}
      />
    );
  }

  // セッション復元中はゲスト導線やトップを一瞬出さない
  if (!currentUser && isResolvingAuth) {
    if (
      isOnSlugPath ||
      guestSpaceId ||
      guestSpaceIsPrivate ||
      pendingLoginSlug ||
      pendingParticipantSpaceId ||
      appRoute === 'default'
    ) {
      return (
        <div style={authResolvingScreenStyle}>
          読み込み中…
        </div>
      );
    }
  }

  // /s/[slug] アクセス中にスペースがまだ解決されていない間は空白を表示
  // GuestEntryScreen と同じ背景色にすることでフラッシュを防ぐ
  if (!currentUser && !isGuestMode && isOnSlugPath && !guestSpaceId && !guestSpaceIsPrivate && !spaceURLNotFound) {
    return (
      <div style={authResolvingScreenStyle}>
        読み込み中…
      </div>
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
        return renderSpaceScreen();
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
        return (
          <AccountScreen
            onLoginRequested={handleParticipantLoginRequested}
            onSignUpRequested={() => handleGuestAuthRequested('signup')}
          />
        );
      case 'settings':
        return <SpaceSettingsScreen />;
      case 'card':
        return <StampCardScreen />;
      case 'reflection':
        return <ReflectionScreen />;
      case 'neighbors':
        return <NeighborsScreen />;
      default:
        return renderSpaceScreen();
    }
  };

  return (
    <div className={styles.appRoot}>
      {screen === 'screen' ? (
        renderScreen()
      ) : (
        <ScaledContent>{renderScreen()}</ScaledContent>
      )}
      {showNicknameModal && pendingSpaceId && (
        <NicknameModal
          spaceId={pendingSpaceId}
          onClose={handleNicknameModalClose}
          variant={currentUser ? 'profile' : 'guest'}
        />
      )}
      <BottomNavBar isMobile={isMobile} onMobilePostPress={handleMobilePostNav} />
      <HossiiToast
        show={visitingToast}
        message="訪問中のスペースには投稿できません"
        type="info"
        duration={2000}
        onClose={() => setVisitingToast(false)}
      />
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
  if (supabaseEnvironmentValidation.shouldBlockApp) {
    return <SupabaseConfigError />;
  }

  return (
    <AuthProvider>
      <AdminNavigationProvider>
        <DisplayPrefsProvider>
          <HossiiProvider initialHossiis={mockHossiis}>
            <SpacePaneProvider>
              <AppContent />
            </SpacePaneProvider>
          </HossiiProvider>
        </DisplayPrefsProvider>
      </AdminNavigationProvider>
      <GlobalClickStarBurst />
      <DevelopmentBanner />
    </AuthProvider>
  );
};

export default App;
