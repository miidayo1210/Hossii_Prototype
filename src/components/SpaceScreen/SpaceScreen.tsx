import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useDisplayPrefs } from '../../core/contexts/DisplayPrefsContext';
import { DISPLAY_SCALE_VALUES } from '../../core/utils/displayScaleStorage';
import { useSpeechRecognition } from '../../core/hooks/useSpeechRecognition';
import { useReactionBroadcast, type ReactionEvent } from '../../core/hooks/useReactionBroadcast';
import { useMediaQuery } from '../../core/hooks/useMediaQuery';
import { useHossiiBrain } from '../../core/hooks/useHossiiBrain';
import { useAuth } from '../../core/contexts/useAuth';
import { useSpaceSettings } from './useSpaceSettings';
import { useNeighborSpace } from './useNeighborSpace';
import type { EmotionKey } from '../../core/types';
import type { SpaceDecoration } from '../../core/types/space';
import { EMOJI_BY_EMOTION } from '../../core/assets/emotions';
import { createBubblePosition, createOrderedBubblePosition } from '../../core/utils/bubblePosition';
import { incrementLike } from '../../core/utils/likesApi';
import { coerceIsHidden } from '../../core/utils/hossiisApi';
import { getPeriodCutoff, loadShowPostCountBadge, saveShowPostCountBadge } from '../../core/utils/displayPrefsStorage';
import { Bubble } from './Tree';
import { StarView } from './StarView';
import { VisitBanner } from './VisitBanner';
import { MessageBottle } from '../MessageBottle/MessageBottle';
import { PostDetailModal } from '../PostDetailModal/PostDetailModal';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { TopBar } from '../Navigation/TopBar';
import { LeftControlBar, type ControlState } from '../Navigation/LeftControlBar';
import { QRCodePanel } from '../Navigation/QRCodePanel';
import { HossiiLive } from '../Hossii/HossiiLive';
import { ListenConsentModal } from '../ListenConsentModal/ListenConsentModal';
import { StarLayer } from '../StarLayer/StarLayer';
import { SlideshowView } from '../Slideshow/SlideshowView';
import { PostScreen } from '../PostScreen/PostScreen';
import { recordBottleDelivery } from '../../core/utils/neighborsApi';
import { SpeechPanel } from '../SpeechPanel/SpeechPanel';
import { FloatingPanelShell } from '../FloatingPanelShell/FloatingPanelShell';
import { LogListBody } from '../CommentsScreen/LogListBody';
import { SpacePanelCubeDock } from './SpacePanelCubeDock';
import { ScaledContent } from '../ScaledContent/ScaledContent';
import {
  getDefaultQuickLogBottomRect,
  getDefaultQuickLogSideRect,
  getDefaultQuickPostBottomRect,
  getDefaultQuickPostSideRect,
} from '../../core/utils/floatingPanelStorage';
import styles from './SpaceScreen.module.css';
import bgStyles from '../../styles/spaceBackgrounds.module.css';

type SpaceScreenProps = {
  /** BottomNavBar の「ログ」からクイックログを開閉するコールバックを登録 */
  registerQuickLogForBottomNav?: (toggle: (() => void) | null) => void;
};

/** カケラ粒子の型 */
type Particle = {
  id: string;
  emoji: string;
  x: number;
  y: number;
};


/** リアクショントリガーの型 */
type ReactionTrigger = {
  id: string;
  emotion?: EmotionKey;
};

export const SpaceScreen = ({ registerQuickLogForBottomNav }: SpaceScreenProps = {}) => {
  const {
    state,
    hossiiLoadedFromSupabase,
    getActiveSpaceHossiis,
    getActiveSpace,
    addHossii,
    setVisitingSpace,
    updateHossiiColorAction,
    updateHossiiPositionAction,
    updateHossiiScaleAction,
    hideHossii,
  } = useHossiiStore();
  const { activeSpaceId, visitingSpaceId } = state;
  const {
    prefs: {
      showHossii, listenMode, hasConsentedToListen,
      speechLevels, displayScale, displayPeriod, displayLimit, viewMode, layoutMode,
      orderedSortDirection,
    },
    setShowHossii,
    setListenMode,
    setListenConsent,
    setDisplayScale,
    setDisplayPeriod,
    setDisplayLimit,
    setViewMode,
    setLayoutMode,
    setOrderedSortDirection,
    setSpeechLevels,
  } = useDisplayPrefs();
  const activeSpace = getActiveSpace();
  const isVisiting = visitingSpaceId !== null;
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.isAdmin ?? false;
  // 現在のユーザーID（匿名含む）
  const myAuthorId = currentUser?.uid ?? state.profile?.id;
  const [activeBubbleId, setActiveBubbleId] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  // 他タブからのリアクションを受け取るための状態
  const [broadcastedReaction, setBroadcastedReaction] = useState<ReactionTrigger | null>(null);
  // 前回の latestHossii.id を追跡（新規投稿検出用）
  const prevLatestIdRef = useRef<string | null>(null);
  // モバイル判定とモーダル用の状態
  const isMobile = useMediaQuery('(max-width: 768px)');
  const quickPostDefaultRect = useMemo(
    () => (isMobile ? getDefaultQuickPostBottomRect() : getDefaultQuickPostSideRect()),
    [isMobile]
  );
  const quickLogDefaultRect = useMemo(
    () => (isMobile ? getDefaultQuickLogBottomRect() : getDefaultQuickLogSideRect()),
    [isMobile]
  );
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  // 音声パネルの開閉と蓄積テキスト
  const [panelConfirmedText, setPanelConfirmedText] = useState('');
  /** listenMode と連動。マイク ON で自動表示（Listening の再タップは折りたたみ用） */
  const [speechPanelOpen, setSpeechPanelOpen] = useState(listenMode);

  /** 音声候補の × で除外した文字列 */
  const [dismissedSpeechCandidates, setDismissedSpeechCandidates] = useState<string[]>([]);

  /** 左バー等で Listen ON にしたときはパネルも開く。OFF にしてもパネルは自動では閉じない（右キューブで開いた場合など） */
  useEffect(() => {
    if (listenMode) {
      setSpeechPanelOpen(true);
    }
  }, [listenMode]);

  useEffect(() => {
    if (!listenMode) {
      setPanelConfirmedText('');
      setDismissedSpeechCandidates([]);
    }
  }, [listenMode]);
  /** 右パネル「編集」から開いたときの置換元テキスト */
  const [speechEditOriginal, setSpeechEditOriginal] = useState<string | undefined>();
  const [speechPostInitialMessage, setSpeechPostInitialMessage] = useState<string | undefined>();
  const [postScreenKey, setPostScreenKey] = useState(0);

  // クイック投稿パネル（setQuickPostPos を下のコールバックより先に宣言）
  const [quickPostPos, setQuickPostPos] = useState<{ x: number; y: number } | null>(null);
  /** ダブルクリック→クイック投稿オープンを遅延させ、トリプルクリックでログパネルに譲る */
  const pendingQuickPostOpenRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [qrPanelVisible, setQrPanelVisible] = useState(true);
  const [showPostCountBadge, setShowPostCountBadge] = useState(loadShowPostCountBadge);

  const handleShowPostCountBadgeToggle = useCallback(() => {
    setShowPostCountBadge((v) => {
      const next = !v;
      saveShowPostCountBadge(next);
      return next;
    });
  }, []);

  const resetQuickPostSpeechState = useCallback(() => {
    setSpeechEditOriginal(undefined);
    setSpeechPostInitialMessage(undefined);
  }, []);

  const handleQuickPostClose = useCallback(() => {
    setQuickPostPos(null);
    resetQuickPostSpeechState();
  }, [resetQuickPostSpeechState]);

  const handleQuickLogClose = useCallback(() => {
    setQuickLogOpen(false);
  }, []);

  const handleQuickLogToggle = useCallback(() => {
    setQuickLogOpen((v) => !v);
  }, []);

  useEffect(() => {
    registerQuickLogForBottomNav?.(handleQuickLogToggle);
    return () => registerQuickLogForBottomNav?.(null);
  }, [registerQuickLogForBottomNav, handleQuickLogToggle]);

  /** 右側キューブから音声パネルを開く／閉じる（閉じるときは全文リセット） */
  const handleSpeechDockToggle = useCallback(() => {
    if (isVisiting) return;
    setSpeechPanelOpen((wasOpen) => {
      if (wasOpen) {
        setPanelConfirmedText('');
        setDismissedSpeechCandidates([]);
      }
      return !wasOpen;
    });
  }, [isVisiting]);

  /** 右側キューブから投稿パネルを開く（中央付きの既定位置）／閉じる */
  const handleQuickPostDockToggle = useCallback(() => {
    if (isVisiting) return;
    if (quickPostPos) {
      handleQuickPostClose();
      return;
    }
    resetQuickPostSpeechState();
    setPostScreenKey((k) => k + 1);
    setQuickPostPos({ x: 50, y: 50 });
  }, [isVisiting, quickPostPos, handleQuickPostClose, resetQuickPostSpeechState]);

  /**
   * クイック投稿パネル（ドックと同じトグル）
   * - Ctrl+N: Mac/Win でページに届き、抑止できる
   * - ⌘+⌥+N: Mac で ⌘+N がブラウザの「新しいウィンドウ」に取られるための代替（⌘+N 単体は登録しない）
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (isVisiting) return;
      if (e.code !== 'KeyN') return;

      const ctrlN = e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
      const cmdAltN = e.metaKey && e.altKey && !e.ctrlKey && !e.shiftKey;
      if (!ctrlN && !cmdAltN) return;

      e.preventDefault();
      e.stopPropagation();
      handleQuickPostDockToggle();
    };
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [isVisiting, handleQuickPostDockToggle]);

  useEffect(() => {
    return () => {
      if (pendingQuickPostOpenRef.current) {
        clearTimeout(pendingQuickPostOpenRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isVisiting && pendingQuickPostOpenRef.current) {
      clearTimeout(pendingQuickPostOpenRef.current);
      pendingQuickPostOpenRef.current = null;
    }
  }, [isVisiting]);

  const handleSaveSpeechDraft = useCallback((original: string, edited: string) => {
    setPanelConfirmedText((prev) => {
      const i = prev.indexOf(original);
      if (i === -1) return prev;
      return prev.slice(0, i) + edited + prev.slice(i + original.length);
    });
    setSpeechEditOriginal(edited);
  }, []);

  const openSpeechCandidateEditor = useCallback((candidate: string) => {
    setSpeechEditOriginal(candidate);
    setSpeechPostInitialMessage(candidate);
    setPostScreenKey((k) => k + 1);
    setQuickPostPos((prev) => prev ?? { x: 50, y: 50 });
  }, []);

  const dismissSpeechCandidate = useCallback((text: string) => {
    setDismissedSpeechCandidates((prev) => [...prev, text]);
  }, []);
  // モバイル: プレビュー表示するHossiiのID（8秒ごとにローテーション、最大3件）
  const [previewHossiiIds, setPreviewHossiiIds] = useState<Set<string>>(new Set());

  // F14: 選択中バブル
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);

  // A02: 選択中の装飾（ポップアップ表示用）
  const [selectedDecorationId, setSelectedDecorationId] = useState<string | null>(null);

  // スペース設定（設定画面から戻ったときにフォーカスで再読み込み）
  const { spaceSettings } = useSpaceSettings(activeSpace);

  // 隣人スペース・訪問モード・漂着ボトル管理
  const {
    neighbors,
    visitingHossiis,
    visitingSpaceInfo,
    bottlePayload,
    setBottlePayload,
    handleWarp,
    removeVisitingHossii,
  } = useNeighborSpace({
    activeSpaceId,
    visitingSpaceId,
    isVisiting,
    spaceSettings,
    setVisitingSpace,
  });

  // 訪問中は背景・タイトル・装飾を訪問先に合わせる（投稿 0 件でも自スペースの見た目が残らないようにする）
  const spaceForVisual =
    isVisiting && visitingSpaceInfo ? visitingSpaceInfo : activeSpace;

  const [likeReactionTrigger, setLikeReactionTrigger] = useState<{ id: string } | null>(null);

  const handleLike = useCallback(async (hossiiId: string) => {
    try {
      await incrementLike(hossiiId);
      setLikeReactionTrigger({ id: `like-${hossiiId}-${Date.now()}` });
    } catch (err) {
      console.error('[SpaceScreen] incrementLike error:', err);
    }
  }, []);

  // PC版コントロールバーの状態管理
  const [controlState, setControlState] = useState<ControlState>({
    isFullscreen: false,
    hossiiVisible: showHossii,
    micEnabled: listenMode,
    voiceEnabled: true,
  });

  // ストアの showHossii / listenMode が変わったら controlState に同期
  useEffect(() => {
    setControlState((prev) => ({ ...prev, hossiiVisible: showHossii }));
  }, [showHossii]);

  useEffect(() => {
    setControlState((prev) => ({ ...prev, micEnabled: listenMode }));
  }, [listenMode]);

  // 同意モーダル表示フラグ
  const [showListenConsent, setShowListenConsent] = useState(false);

  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile) return;
    if (e.detail !== 3) return;
    if (pendingQuickPostOpenRef.current) {
      clearTimeout(pendingQuickPostOpenRef.current);
      pendingQuickPostOpenRef.current = null;
    }
    setQuickLogOpen((v) => !v);
  }, [isMobile]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // 訪問モードは閲覧専用（仕様 44）。クイック投稿は自 activeSpace へ投稿されるためここでは開かない
    if (isVisiting) return;
    if (quickPostPos) {
      setQuickPostPos(null);
      resetQuickPostSpeechState();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    resetQuickPostSpeechState();
    setPostScreenKey((k) => k + 1);
    pendingQuickPostOpenRef.current = setTimeout(() => {
      pendingQuickPostOpenRef.current = null;
      setQuickPostPos({ x, y });
    }, 320);
  }, [isVisiting, quickPostPos, resetQuickPostSpeechState]);

  useEffect(() => {
    if (isVisiting && quickPostPos) {
      setQuickPostPos(null);
      resetQuickPostSpeechState();
    }
  }, [isVisiting, quickPostPos, resetQuickPostSpeechState]);

  const handleControlToggle = useCallback((key: keyof ControlState) => {
    if (key === 'hossiiVisible') {
      // ストアを直接更新（controlState は useEffect で同期される）
      setShowHossii(!showHossii);
    } else if (key === 'micEnabled') {
      if (listenMode) {
        setListenMode(false);
      } else if (hasConsentedToListen) {
        setListenMode(true);
      } else {
        setShowListenConsent(true);
      }
    } else {
      // voiceEnabled / isFullscreen はローカル state のみ管理
      setControlState((prev) => ({ ...prev, [key]: !prev[key] }));
    }
  }, [showHossii, listenMode, hasConsentedToListen, setShowHossii, setListenMode]);

  /** 音声パネル内の Listen ON/OFF（左バーと同じ同意フロー） */
  const handleSpeechPanelListenToggle = useCallback(() => {
    if (listenMode) {
      setListenMode(false);
    } else if (hasConsentedToListen) {
      setListenMode(true);
    } else {
      setShowListenConsent(true);
    }
  }, [listenMode, hasConsentedToListen, setListenMode]);

  const handleFullscreenToggle = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Fullscreen request failed:', err);
      });
      setControlState((prev) => ({ ...prev, isFullscreen: true }));
    } else {
      document.exitFullscreen();
      setControlState((prev) => ({ ...prev, isFullscreen: false }));
    }
  }, []);

  // DisplayScale を循環させる（75% → 100% → 125% → 150% → 75%...）
  const handleDisplayScaleCycle = useCallback(() => {
    const scales = DISPLAY_SCALE_VALUES;
    const currentIndex = scales.indexOf(displayScale);
    const nextIndex = (currentIndex + 1) % scales.length;
    setDisplayScale(scales[nextIndex]);
  }, [displayScale, setDisplayScale]);

  // F02/F04: バブル編集権限チェック
  const canEditBubble = useCallback((hossii: { authorId?: string }) => {
    if (isAdmin) return true;
    const permission = spaceSettings?.bubbleEditPermission ?? 'all';
    if (permission === 'all') return true;
    // owner_and_admin: 投稿者本人のみ（authorId が一致する場合）
    return !!myAuthorId && hossii.authorId === myAuthorId;
  }, [isAdmin, spaceSettings, myAuthorId]);

  // ===== F14: 選択ハンドラ =====
  const handleBubbleSelect = useCallback((id: string) => {
    setSelectedBubbleId(id);
  }, []);

  const handleBubbleDeselect = useCallback(() => {
    setSelectedBubbleId(null);
  }, []);

  // F06: 非表示（管理者のみ）
  const handleHideBubble = useCallback(() => {
    if (!selectedBubbleId) return;
    hideHossii(selectedBubbleId);
    setSelectedBubbleId(null);
  }, [selectedBubbleId, hideHossii]);

  // F04: PointerUp で即座に位置保存
  const handlePositionSave = useCallback((id: string, x: number, y: number) => {
    updateHossiiPositionAction(id, x, y);
  }, [updateHossiiPositionAction]);

  // F05: PointerUp で即座にスケール保存
  const handleScaleSave = useCallback((id: string, scale: number) => {
    updateHossiiScaleAction(id, scale);
  }, [updateHossiiScaleAction]);

  // F01: カラー選択で即座に保存
  const handleColorSave = useCallback((id: string, color: string | null) => {
    updateHossiiColorAction(id, color);
  }, [updateHossiiColorAction]);

  // Escape キーでデセレクト
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedBubbleId(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 他タブからリアクションを受信
  const handleBroadcastReaction = useCallback((event: ReactionEvent) => {
    setBroadcastedReaction({
      id: event.hossiiId,
      emotion: event.emotion,
    });
  }, []);

  // リアクションブロードキャスト
  const { broadcastReaction } = useReactionBroadcast({
    activeSpaceId,
    onReaction: handleBroadcastReaction,
  });

  // 音声パネル用: 確定テキストを蓄積（最大300文字）。スペースへの自動投稿は行わない（候補の手動投稿のみ）
  const handleFinalSegment = useCallback((text: string) => {
    setPanelConfirmedText(prev => {
      const next = prev + text;
      return next.length > 300 ? next.slice(-300) : next;
    });
  }, []);

  // 音声認識（listenMode ON の間は常に動作。onSpeechEvent は渡さず文字起こし＋パネル候補のみ）
  const { interimText, isRecognizing } = useSpeechRecognition({
    enabled: listenMode,
    speechLevels,
    onFinalSegment: handleFinalSegment,
  });

  // Hossii AI Brain（音声トグルONの時のみ有効）
  const { currentMessage: brainMessage, reactToPost } = useHossiiBrain({
    enabled: controlState.voiceEnabled,
  });

  // 訪問モード中は訪問先 hossiis を使用、それ以外は自スペース
  const hossiis = isVisiting ? visitingHossiis : getActiveSpaceHossiis();

  // カケラ粒子を発生させるコールバック
  const handleParticle = useCallback((emotion: EmotionKey) => {
    const emoji = EMOJI_BY_EMOTION[emotion];
    const count = 3 + Math.floor(Math.random() * 4); // 3〜6個
    const newParticles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      // 中央寄りのランダム位置（20%〜80%）
      const x = 20 + Math.random() * 60;
      const y = 25 + Math.random() * 50;
      newParticles.push({
        id: `${Date.now()}-${i}`,
        emoji,
        x,
        y,
      });
    }

    setParticles(newParticles);

    // 1.2秒後に消す
    setTimeout(() => setParticles([]), 1200);
  }, []);

  // 新しい順にソートして上限まで表示（非表示・期間フィルタ・表示モードを適用）
  const displayHossiis = useMemo(() => {
    const cutoff = getPeriodCutoff(displayPeriod);
    const limit = displayLimit === 'unlimited' ? Infinity : displayLimit;
    const visible = hossiis.filter((h) => {
      if (coerceIsHidden(h.isHidden)) return false;
      if (cutoff && h.createdAt < cutoff) return false;
      if (viewMode === 'image' && !h.imageUrl) return false;
      return true;
    });
    const sorted = [...visible].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return sorted.slice(0, limit);
  }, [hossiis, displayPeriod, displayLimit, viewMode]);

  // 画面上の一覧は新しい順なので、先頭 N 件を「直近投稿」として視覚的に強調する
  const RECENT_HIGHLIGHT_COUNT = 5;
  const recentHighlightIds = useMemo(
    () => new Set(displayHossiis.slice(0, RECENT_HIGHLIGHT_COUNT).map((h) => h.id)),
    [displayHossiis]
  );

  // 各バブルの位置を事前計算（メモ化）
  const bubblePositions = useMemo(() => {
    if (layoutMode === 'ordered') {
      return displayHossiis.map((_, i) =>
        createOrderedBubblePosition(i, displayHossiis.length)
      );
    }
    return displayHossiis.map((_, i) => createBubblePosition(i));
  }, [displayHossiis, layoutMode]);

  // モバイル: コンテンツ（テキストor画像）を持つ投稿をランダムで3件プレビュー表示（8秒ローテーション）
  useEffect(() => {
    if (!isMobile) return;
    const postsWithContent = displayHossiis.filter((h) => h.message || h.imageUrl);
    if (postsWithContent.length === 0) {
      setPreviewHossiiIds(new Set());
      return;
    }
    const pick = () => {
      const shuffled = [...postsWithContent].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, Math.min(3, shuffled.length)).map((h) => h.id);
      setPreviewHossiiIds(new Set(picked));
    };
    pick();
    const interval = setInterval(pick, 6000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, displayHossiis.length]);

  // 最新の投稿（HossiiLive用）
  const latestHossii = displayHossiis[0] ?? null;

  // 新しい投稿を検出してブロードキャスト & Brain反応
  useEffect(() => {
    if (!latestHossii) return;

    const currentId = latestHossii.id;
    if (currentId !== prevLatestIdRef.current) {
      // 新規投稿を検出 → 他タブにブロードキャスト
      broadcastReaction({
        hossiiId: currentId,
        emotion: latestHossii.emotion,
        authorName: latestHossii.authorName,
        logType: latestHossii.logType,
        speechLevel: latestHossii.speechLevel,
      });
      prevLatestIdRef.current = currentId;

      // 手動投稿の場合、Brain に反応させる
      const isManual = !latestHossii.origin || latestHossii.origin === 'manual';
      if (isManual && latestHossii.message) {
        reactToPost(latestHossii.message);
      }
    }
  }, [latestHossii, broadcastReaction, reactToPost]);

  // HossiiLive 用のトリガー（ブロードキャストされたものを優先）
  // broadcastedReaction があればそれを使用し、なければ latestHossii を使用
  const reactionTrigger = useMemo<ReactionTrigger | null>(() => {
    // ブロードキャストされたリアクションがあり、かつ latestHossii と異なる場合は優先
    if (broadcastedReaction && broadcastedReaction.id !== latestHossii?.id) {
      return broadcastedReaction;
    }
    if (latestHossii) {
      return { id: latestHossii.id, emotion: latestHossii.emotion };
    }
    return null;
  }, [broadcastedReaction, latestHossii]);

  // 背景スタイルを生成（訪問中は visitingSpaceInfo の background を使用）
  const { backgroundClass, backgroundStyle } = useMemo(() => {
    const bg = spaceForVisual?.background;
    if (!bg) {
      // デフォルト背景（パターン: mist）
      return {
        backgroundClass: `${bgStyles.bgBase} ${bgStyles.pattern_mist}`,
        backgroundStyle: {},
      };
    }

    if (bg.kind === 'color') {
      return {
        backgroundClass: bgStyles.bgBase,
        backgroundStyle: { backgroundColor: bg.value },
      };
    }

    if (bg.kind === 'pattern') {
      const patternClass = bgStyles[`pattern_${bg.value}`] || bgStyles.pattern_mist;
      return {
        backgroundClass: `${bgStyles.bgBase} ${patternClass}`,
        backgroundStyle: {},
      };
    }

    if (bg.kind === 'image') {
      return {
        backgroundClass: `${bgStyles.bgBase} ${bgStyles.bgImage}`,
        backgroundStyle: { backgroundImage: `url(${bg.value})` },
      };
    }

    // フォールバック
    return {
      backgroundClass: `${bgStyles.bgBase} ${bgStyles.pattern_mist}`,
      backgroundStyle: {},
    };
  }, [spaceForVisual]);

  // モバイルモーダル用の選択された投稿
  const selectedPost = selectedPostId
    ? displayHossiis.find(h => h.id === selectedPostId)
    : null;

  // クイックログパネル: 画面上のスペース（訪問中は隣人）と一覧を揃える
  const logListSpaceId = isVisiting ? visitingSpaceId : activeSpaceId;
  const logListHossiis = isVisiting ? visitingHossiis : getActiveSpaceHossiis();
  const logPresetTags =
    isVisiting && visitingSpaceInfo
      ? visitingSpaceInfo.presetTags ?? []
      : activeSpace?.presetTags ?? [];

  return (
    <div
      className={styles.container}
      onClick={handleContainerClick}
      onDoubleClick={handleDoubleClick}
    >
      <ScaledContent
        className={`${styles.scaledCanvas} ${backgroundClass}`}
        style={backgroundStyle}
      >
      {/* 訪問モードバナー */}
      {isVisiting && visitingSpaceInfo && (
        <VisitBanner
          spaceName={visitingSpaceInfo.name}
          spaceURL={visitingSpaceInfo.spaceURL}
          onBack={() => setVisitingSpace(null)}
        />
      )}

      {/* Supabase から hossiis をロード中のオーバーレイ */}
      {!hossiiLoadedFromSupabase && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.18)',
          backdropFilter: 'blur(2px)',
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '4px solid rgba(255,255,255,0.3)',
            borderTopColor: '#fff',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* 星レイヤー（Hossii OFF時のみ表示） */}
      <StarLayer />

      {/* スペースタイトル（情報レイヤー） */}
      <div className={styles.spaceTitle}>
        🌳 {spaceForVisual?.name ?? 'My Space'}
      </div>

      {/* 右上: 投稿数バッジ / 投稿順ツールバー */}
      {(showPostCountBadge || (layoutMode === 'ordered' && viewMode !== 'slideshow')) && (
        <div className={styles.spaceTopRightCluster}>
          {showPostCountBadge && (
            <div
              className={styles.postCountBadge}
              aria-live="polite"
              title="現在の期間・件数・表示モードで画面に出ている投稿数"
            >
              <span className={styles.postCountBadgeValue}>{displayHossiis.length}</span>
              <span className={styles.postCountBadgeUnit}>件</span>
            </div>
          )}
          {layoutMode === 'ordered' && viewMode !== 'slideshow' && (
            <div className={styles.orderedSortToolbar} role="group" aria-label="投稿順の整列方向">
              <button
                type="button"
                className={`${styles.orderedSortButton} ${orderedSortDirection === 'desc' ? styles.orderedSortButtonActive : ''}`}
                title="新しい投稿を左上から（降順）"
                aria-pressed={orderedSortDirection === 'desc'}
                onClick={() => setOrderedSortDirection('desc')}
              >
                降順
              </button>
              <button
                type="button"
                className={`${styles.orderedSortButton} ${orderedSortDirection === 'asc' ? styles.orderedSortButtonActive : ''}`}
                title="古い投稿を左上から（昇順）"
                aria-pressed={orderedSortDirection === 'asc'}
                onClick={() => setOrderedSortDirection('asc')}
              >
                昇順
              </button>
            </div>
          )}
        </div>
      )}

      {/* スライドショーモード */}
      {viewMode === 'slideshow' && (
        <SlideshowView
          hossiis={displayHossiis}
          onExit={() => setViewMode('full')}
        />
      )}

      {/* バブルエリア（背景クリックでデセレクト） */}
      <div
        className={styles.bubbleArea}
        data-bubble-area
        onPointerDown={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest('[data-hossii-bubble]')) {
            setSelectedBubbleId(null);
          }
        }}
      >
        {displayHossiis.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🌸</span>
            <p className={styles.emptyText}>まだ気持ちがありません</p>
          </div>
        ) : (
          displayHossiis.map((hossii, index) => {
            const n = displayHossiis.length;
            // 投稿順: 降順＝新しいほど左上（index 一致）、昇順＝古いほど左上（セル index を反転）
            const orderedGridIndex =
              layoutMode === 'ordered' && orderedSortDirection === 'asc'
                ? n - 1 - index
                : index;
            // ランダム: 固定座標があれば優先。投稿順: 常に格子の計算座標（全件きれいに整列）
            const pos =
              layoutMode === 'random' &&
              hossii.isPositionFixed &&
              hossii.positionX != null &&
              hossii.positionY != null
                ? { x: hossii.positionX, y: hossii.positionY }
                : layoutMode === 'ordered'
                  ? bubblePositions[orderedGridIndex]
                  : bubblePositions[index];

            const isThisSelected = selectedBubbleId === hossii.id;

            // モバイル: スターを表示
            if (isMobile) {
              return (
                <StarView
                  key={hossii.id}
                  hossii={hossii}
                  x={pos.x}
                  y={pos.y}
                  anchor={layoutMode === 'ordered' ? 'topLeft' : 'center'}
                  onClick={() => setSelectedPostId(hossii.id)}
                  showPreview={previewHossiiIds.has(hossii.id)}
                  isRecentHighlight={recentHighlightIds.has(hossii.id)}
                  orderedStackZ={
                    layoutMode === 'ordered' ? orderedGridIndex + 1 : undefined
                  }
                />
              );
            }

            return (
              <Bubble
                key={hossii.id}
                hossii={hossii}
                index={index}
                position={pos}
                orderedStackZ={
                  layoutMode === 'ordered' ? orderedGridIndex + 1 : undefined
                }
                isActive={activeBubbleId === hossii.id}
                onActivate={() =>
                  setActiveBubbleId(
                    activeBubbleId === hossii.id ? null : hossii.id
                  )
                }
                isSelected={isThisSelected}
                onSelect={handleBubbleSelect}
                onPositionSave={handlePositionSave}
                onScaleSave={handleScaleSave}
                onColorSave={handleColorSave}
                viewMode={viewMode}
                canEdit={canEditBubble(hossii)}
                likesEnabled={spaceSettings?.features.likesEnabled ?? false}
                onLike={handleLike}
                bubbleShapePng={hossii.bubbleShapePng ?? spaceForVisual?.bubbleShapePng}
                layoutAlignTopLeft={layoutMode === 'ordered'}
                isRecentHighlight={recentHighlightIds.has(hossii.id)}
              />
            );
          })
        )}
      </div>

      {/* カケラ粒子（Hossii表示時のみ） */}
      {controlState.hossiiVisible &&
        particles.map((p) => (
          <span
            key={p.id}
            className={styles.particle}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            {p.emoji}
          </span>
        ))}

      {/* Hossiiキャラ（Hossii表示時のみ） */}
      {controlState.hossiiVisible && (
        <HossiiLive
          lastTriggerId={reactionTrigger?.id}
          emotion={reactionTrigger?.emotion}
          onParticle={handleParticle}
          isListening={isRecognizing}
          hossiiColor={spaceSettings?.hossiiColor}
          brainMessage={brainMessage?.text ?? null}
          hossiis={displayHossiis}
          readingEnabled={controlState.voiceEnabled}
          onLikeTrigger={likeReactionTrigger?.id}
        />
      )}

      {/* Listening インジケーター（タップで音声パネル開閉） */}
      {listenMode && (
        <div
          className={styles.listeningIndicator}
          onClick={() => setSpeechPanelOpen(prev => !prev)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSpeechPanelOpen(prev => !prev); }}
        >
          <span className={styles.listeningIcon}>🎙</span>
          <span className={styles.listeningText}>Listening</span>
        </div>
      )}

      {/* F14: 選択時ツールバー（中央ドラッグで移動・コーナーハンドルでリサイズ） */}
      {selectedBubbleId && (
        <div className={styles.editToolbar}>
          <span className={styles.editToolbarHint}>
            ドラッグで移動 · 角ハンドルでリサイズ
          </span>
          {isAdmin && (
            <button
              type="button"
              className={`${styles.editToolbarBtn} ${styles.editToolbarBtnHide}`}
              onClick={handleHideBubble}
            >
              🚫 非表示
            </button>
          )}
          <button
            type="button"
            className={`${styles.editToolbarBtn} ${styles.editToolbarBtnCancel}`}
            onClick={handleBubbleDeselect}
          >
            ✕ 選択解除
          </button>
        </div>
      )}

      {/* A02: スペース装飾オーバーレイ */}
      {(spaceForVisual?.decorations ?? []).map((decoration: SpaceDecoration) => {
        const isOpen = selectedDecorationId === decoration.id;
        return (
          <div
            key={decoration.id}
            className={styles.decorationWidget}
            style={{ left: `${decoration.position.x}%`, top: `${decoration.position.y}%` }}
            onClick={() => setSelectedDecorationId(isOpen ? null : decoration.id)}
          >
            <span className={styles.decorationIcon}>📋</span>
            {decoration.content.title && (
              <span className={styles.decorationTitle}>{decoration.content.title}</span>
            )}
            {isOpen && (
              <div
                className={styles.decorationPopup}
                onClick={(e) => e.stopPropagation()}
              >
                {decoration.content.title && (
                  <p className={styles.decorationPopupTitle}>{decoration.content.title}</p>
                )}
                <p className={styles.decorationPopupBody}>{decoration.content.body}</p>
                <button
                  type="button"
                  className={styles.decorationPopupClose}
                  onClick={() => setSelectedDecorationId(null)}
                >
                  閉じる
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* 漂着メッセージボトル */}
      {bottlePayload && !isVisiting && (
        <MessageBottle
          payload={bottlePayload}
          onOpen={() => {
            recordBottleDelivery(activeSpaceId, bottlePayload.hossii.id, bottlePayload.fromSpace.id);
          }}
          onDismiss={() => setBottlePayload(null)}
        />
      )}
      </ScaledContent>

      {/* 音声パネル（body に portal — 表示倍率の zoom 対象外） */}
      {speechPanelOpen &&
        createPortal(
          <SpeechPanel
            listenMode={listenMode}
            onListenToggle={handleSpeechPanelListenToggle}
            confirmedText={panelConfirmedText}
            interimText={interimText}
            speechLevels={speechLevels}
            setSpeechLevels={setSpeechLevels}
            onPost={(text) => addHossii({ message: text, logType: 'speech', origin: 'manual' })}
            onEditCandidate={openSpeechCandidateEditor}
            onDismissCandidate={dismissSpeechCandidate}
            dismissedCandidates={dismissedSpeechCandidates}
            onClose={() => {
              setSpeechPanelOpen(false);
              setPanelConfirmedText('');
              setDismissedSpeechCandidates([]);
            }}
          />,
          document.body
        )}

      {/* モバイル: 詳細モーダル */}
      {selectedPost && (
        <PostDetailModal
          hossii={selectedPost}
          onClose={() => setSelectedPostId(null)}
          likesEnabled={spaceSettings?.features.likesEnabled ?? false}
          onLike={handleLike}
        />
      )}

      {/* Listen 同意モーダル（左バーのマイクボタン用） */}
      {showListenConsent && (
        <ListenConsentModal
          onConsent={() => {
            setListenConsent(true);
            setListenMode(true);
            setShowListenConsent(false);
          }}
          onCancel={() => setShowListenConsent(false)}
        />
      )}

      {/* PC版のみ表示: トップバー、右上メニュー、左コントロールバー、QR */}
      {viewMode !== 'slideshow' && (
        <>
          <TopBar />
          <TopRightMenu />
          <LeftControlBar
            controls={controlState}
            onToggle={handleControlToggle}
            onFullscreenToggle={handleFullscreenToggle}
            displayScale={displayScale}
            onDisplayScaleCycle={handleDisplayScaleCycle}
            displayPeriod={displayPeriod}
            onDisplayPeriodChange={setDisplayPeriod}
            displayLimit={displayLimit}
            onDisplayLimitChange={setDisplayLimit}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            layoutMode={layoutMode}
            onLayoutModeChange={setLayoutMode}
            neighbors={neighbors}
            onWarp={handleWarp}
            isVisiting={isVisiting}
            qrPanelVisible={qrPanelVisible}
            onQrToggle={() => setQrPanelVisible((v) => !v)}
            showPostCountBadge={showPostCountBadge}
            onShowPostCountBadgeToggle={handleShowPostCountBadgeToggle}
          />
          {!isMobile && (
            <SpacePanelCubeDock
              quickPostOpen={!!quickPostPos}
              quickLogOpen={quickLogOpen}
              speechPanelOpen={speechPanelOpen}
              onQuickPostToggle={handleQuickPostDockToggle}
              onQuickLogToggle={handleQuickLogToggle}
              onSpeechPanelToggle={handleSpeechDockToggle}
              postDisabled={isVisiting}
              speechDisabled={isVisiting}
            />
          )}
        </>
      )}

      {/* クイック投稿パネル */}
      {quickPostPos && (
        <FloatingPanelShell
          storageKey={isMobile ? 'quickPost.mobile' : 'quickPost.desktop'}
          defaultRect={quickPostDefaultRect}
          minW={isMobile ? 200 : 280}
          minH={isMobile ? 240 : 320}
          zIndex={310}
          className={isMobile ? styles.quickPostBottomChrome : styles.quickPostSideChrome}
        >
          <PostScreen
            key={postScreenKey}
            panelMode={isMobile ? 'bottom' : 'side'}
            initialPosition={quickPostPos}
            initialMessage={speechPostInitialMessage}
            speechEditMode={!!speechEditOriginal}
            speechEditOriginal={speechEditOriginal}
            onSaveSpeechDraft={handleSaveSpeechDraft}
            onClose={handleQuickPostClose}
          />
        </FloatingPanelShell>
      )}

      {quickLogOpen && (
        <FloatingPanelShell
          storageKey={isMobile ? 'logList.mobile' : 'logList.desktop'}
          defaultRect={quickLogDefaultRect}
          minW={isMobile ? 200 : 280}
          minH={isMobile ? 240 : 320}
          zIndex={320}
          className={isMobile ? styles.quickLogBottomChrome : styles.quickLogSideChrome}
        >
          <LogListBody
            hossiis={logListHossiis}
            spaceId={logListSpaceId}
            presetTags={logPresetTags}
            panelMode
            onClose={handleQuickLogClose}
            onAfterAdminHide={isVisiting ? removeVisitingHossii : undefined}
          />
        </FloatingPanelShell>
      )}
      {viewMode !== 'slideshow' && qrPanelVisible && <QRCodePanel />}
    </div>
  );
};
