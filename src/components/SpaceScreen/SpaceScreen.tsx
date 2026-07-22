import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { CSSProperties } from 'react';
import { Hash, ImageDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useDisplayPrefs } from '../../core/contexts/DisplayPrefsContext';
import { DISPLAY_SCALE_VALUES } from '../../core/utils/displayScaleStorage';
import { useSpeechRecognition } from '../../core/hooks/useSpeechRecognition';
import { useReactionBroadcast, type ReactionEvent } from '../../core/hooks/useReactionBroadcast';
import { useMediaQuery } from '../../core/hooks/useMediaQuery';
import { useRouter } from '../../core/hooks/useRouter';
import { useHossiiBrain } from '../../core/hooks/useHossiiBrain';
import { useAuth } from '../../core/contexts/useAuth';
import { useSelectedCommunity } from '../../core/contexts/useSelectedCommunity';
import { useSpaceSettings } from '../../core/hooks/useSpaceSettings';
import { useHossiiGuideBubble } from '../../core/hooks/useHossiiGuideBubble';
import { useNeighborSpace } from './useNeighborSpace';
import type { EmotionKey, Hossii, AddHossiiInput } from '../../core/types';
import type { SpaceDecoration } from '../../core/types/space';
import { EMOJI_BY_EMOTION } from '../../core/assets/emotions';
import { mapLogicalToContainerPercent, mapContainerPercentToLogical } from '../../core/utils/sharpContentRect';
import { useSharpContentRect } from '../../core/hooks/useSharpContentRect';
import { mutateLike, type LikeMutationResult } from '../../core/utils/likesApi';
import { loadShowPostCountBadge, saveShowPostCountBadge } from '../../core/utils/displayPrefsStorage';
import { resolveAnimationLevel, displayStackZFromIndex } from '../../core/utils/animationLevel';
import { runDisplayPipeline } from '../../core/utils/hossiiDisplayPipeline';
import { computeBubblePositions, type PositionCache } from '../../core/utils/hossiiPositionCache';
import { useSpaceHossiiFetch } from '../../core/hooks/useSpaceHossiiFetch';
import { usePinnedHossiis } from '../../core/hooks/usePinnedHossiis';
import { buildQueryKeyV2 } from '../../core/utils/hossiiQueryKey';
import { materializeHossiisArray } from '../../core/utils/hossiiEntitiesState';
import { shouldShowMyHossiiLayer } from '../../core/utils/myHossiiLayerVisibility';
import { isDefaultPane, type PaneContext } from '../../core/utils/hossiiPaneMembership';
import { useSpacePane } from '../../core/hooks/SpacePaneProvider';
import { resolveTimelineDepthActive } from '../../core/utils/resolveTimelineDepthActive';
import { useTimelineDepthEnabled } from './useTimelineDepthEnabled';
import { isSupabaseConfigured } from '../../core/supabase';
import {
  loadPresentationMode,
  savePresentationMode,
  type PresentationMode,
} from '../../core/utils/presentationModeStorage';
import {
  loadSpaceTagFilter,
  saveSpaceTagFilter,
} from '../../core/utils/spaceTagFilterStorage';
import { computePreviewSlotCount } from '../../core/utils/previewSlotCount';
import { resolveCanvasExportAllowed } from '../../core/utils/spaceSettingResolvers';
import { resolveCanEditBubble } from '../../core/utils/canEditBubble';
import { canManageOwnPost } from '../../core/utils/canManageOwnPost';
import {
  isSpaceArchivedReadOnly,
  resolveBubbleCanEditForArchivedSpace,
  resolveCanManageOwnForArchivedSpace,
  resolveLikesEnabledForArchivedSpace,
} from '../../core/utils/spaceArchivePolicy';
import { ensureMyPersonalSpace } from '../../core/utils/personalSpacesApi';
import { fetchSpaceByUrl } from '../../core/utils/spacesApi';
import { defaultSpacePaneId } from '../../core/utils/spacePanesApi';
import {
  applyPostTargetToInput,
  resolveContentSpaceId,
  resolvePersonalPostTarget,
} from '../../core/utils/personalSpaceTabView';
import { buildSpaceShareUrl } from '../../core/utils/spaceShareUrl';
import { buildSpaceExportFilename } from '../../core/utils/spaceExportFilename';
import {
  exportSpaceCanvasWithFrame,
  downloadSpaceExportBlob,
  SpaceExportError,
  SPACE_EXPORT_MAX_BUBBLES,
} from '../../core/utils/spaceCanvasExport';
import { buildDevMockHossiiConnections } from '../../demo/mockHossiiConnections';
import { Bubble } from './Tree';
import { ConnectionOverlay } from './ConnectionOverlay';
import { DEFAULT_STAR_MARKER } from '../../core/types/settings';
import { StarView } from './StarView';
import { StarHoverPreview } from './StarHoverPreview';
import { PinTray } from './PinTray';
import { TagFilterPopover } from './TagFilterPopover';
import { AuthorClusterBubble } from './AuthorClusterBubble';
import { AuthorTimelineModal } from './AuthorTimelineModal';
import { groupHossiisByAuthor, sortAuthorGroups } from '../../core/utils/groupHossiisByAuthor';
import type { AuthorPostGroup } from '../../core/utils/authorPostGroup';
import { VisitBanner } from './VisitBanner';
import { SpaceArchiveBanner } from './SpaceArchiveBanner';
import { SpaceArchivePostNotice } from './SpaceArchivePostNotice';
import { MessageBottle } from '../MessageBottle/MessageBottle';
import { PostDetailModal } from '../PostDetailModal/PostDetailModal';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { TopBar } from '../Navigation/TopBar';
import { LeftControlBar, type ControlState } from '../Navigation/LeftControlBar';
import { QRCodePanel } from '../Navigation/QRCodePanel';
import { SpaceDescriptionInline } from './SpaceDescriptionInline';
import { SpacePaneBar } from './SpacePaneBar';
import { SpacePaneCreateDialog } from './SpacePaneCreateDialog';
import { resolvePaneBackground } from '../../core/utils/resolvePaneBackground';
import { resolvePaneVisualSpace } from '../../core/utils/resolvePaneVisualSpace';
import { shouldShowSpacePaneBar } from '../../core/utils/spacePaneBarVisibility';
import { canShowPersonalShortcut, isSharedSpaceShell, isViewingOwnPersonalSpace } from '../../core/utils/personalSpaceShortcut';
import { MY_SPACE_OPEN_ERROR } from '../../core/utils/mySpaceCopy';
import { applySpacePaneSortOrders, updateSpacePane } from '../../core/utils/spacePanesApi';
import {
  buildTabFolderPatch,
  computeVisiblePaneReorderUpdates,
  resolvePaneFolderId,
  splitPanesByFolders,
} from '../../core/utils/spacePaneTabBar';
import {
  DEFAULT_FOLDER,
  DEFAULT_FOLDER_ID,
  type TabFolder,
  clearLegacyLocalTabFolders,
  migrateLegacyLocalTabFoldersIfNeeded,
  normalizeStoredTabFolders,
  reorderTabFolders,
  resolveEffectiveTabFolders,
} from '../../core/utils/tabFolderStorage';
import {
  exposeTabSyncCheck,
  logTabSyncDiagnostics,
} from '../../core/utils/tabSyncDiagnostics';
import { HossiiLive } from '../Hossii/HossiiLive';
import { MyHossiiLayer } from '../MyHossii/MyHossiiLayer';
import { fetchMyHossiiSettings, isMyHossiiRegistered } from '../../core/utils/userProfilesApi';
import { fetchParticipantEligibility } from '../../core/utils/myHossiiParticipationApi';
import type { ParticipantEligibility } from '../../core/utils/myHossiiAppearance';
import { ListenConsentModal } from '../ListenConsentModal/ListenConsentModal';
import { VoiceConsentModal } from '../VoiceConsentModal/VoiceConsentModal';
import { StarLayer } from '../StarLayer/StarLayer';
import { SlideshowView } from '../Slideshow/SlideshowView';
import { PostScreen } from '../PostScreen/PostScreen';
import { recordBottleDelivery } from '../../core/utils/neighborsApi';
import { SpeechPanel } from '../SpeechPanel/SpeechPanel';
import { FloatingPanelShell } from '../FloatingPanelShell/FloatingPanelShell';
import { LogListBody } from '../CommentsScreen/LogListBody';
import { ScaledContent } from '../ScaledContent/ScaledContent';
import { HossiiToast } from '../../core/ui/HossiiToast';
import { POST_FAILURE_EVENT, formatPostFailureForDisplay, type PostFailureDetail } from '../../core/utils/postFeedback';
import { isActiveSpaceShellUnavailable } from '../../core/utils/spaceShellAvailability';
import { SpaceShellUnavailableView } from './SpaceShellUnavailableView';
import { hasSeenSpaceGuide, markSpaceGuideSeen } from '../../core/utils/spaceGuideStorage';
import { SpaceWelcomeGuide } from './SpaceWelcomeGuide';
import {
  getDefaultQuickLogBottomRect,
  getDefaultQuickLogSideRect,
  getDefaultQuickPostBottomRect,
  getDefaultQuickPostSideRect,
  getDefaultSpeechRect,
  getDefaultSpeechRectMobileMic,
} from '../../core/utils/floatingPanelStorage';
import styles from './SpaceScreen.module.css';
import bgStyles from '../../styles/spaceBackgrounds.module.css';

/** 画像壁紙を contain にしたときのレターボックス色（仕様 70・永続化は後続） */
const SPACE_IMAGE_LETTERBOX_COLOR = '#0f172a';

/** React のコミット後に描画まで待つ（仕様 68: 選択解除した編集 UI が PNG に残らないようにする） */
function waitForDoubleRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

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

export type SpaceScreenHandle = {
  toggleQuickPost: () => void;
  openQuickPost: () => void;
  closeQuickPost: () => void;
};

type SpaceScreenProps = {
  pendingQuickPostOpen?: boolean;
  onPendingQuickPostConsumed?: () => void;
};

export const SpaceScreen = forwardRef<SpaceScreenHandle, SpaceScreenProps>(function SpaceScreen(
  { pendingQuickPostOpen = false, onPendingQuickPostConsumed },
  ref
) {
  const {
    state,
    spacesLoadedFromSupabase,
    hossiiLoadedFromSupabase,
    getActiveSpaceHossiis,
    getHossiisForQueryKey,
    getActiveSpace,
    addHossii,
    setVisitingSpace,
    updateHossiiColorAction,
    updateHossiiPositionAction,
    updateHossiiScaleAction,
    updateHossiiLikeCountAction,
    hideHossii,
    communitySlug,
    syncFetchedHossiis,
    setHossiiFetchLoading,
    updateSpace,
    addSpaceLocal,
    myAuthorshipIds,
    myAuthorshipIdsStatus,
    postAuthorDisplayNames,
    getActiveNickname,
  } = useHossiiStore();
  const { activeSpaceId, visitingSpaceId } = state;
  const hossiisRef = useRef(state.hossiis);
  hossiisRef.current = state.hossiis;
  const {
    prefs: {
      showHossii, listenMode, hasConsentedToListen,
      voiceEnabled, hasConsentedToVoice,
      speechLevels, displayScale, displayPeriod, displayLimit, viewMode, layoutMode,
      orderedSortDirection, authorGroupSort,
    },
    setShowHossii,
    setListenMode,
    setListenConsent,
    setVoiceEnabled,
    setVoiceConsent,
    setDisplayScale,
    setDisplayPeriod,
    setDisplayLimit,
    setViewMode,
    setLayoutMode,
    setOrderedSortDirection,
    setAuthorGroupSort,
    setSpeechLevels,
  } = useDisplayPrefs();

  const {
    activePaneId: contextActivePaneId,
    activePane,
    visiblePanes,
    defaultPane,
    panes,
    isLoading: panesLoading,
    setActivePaneById,
    reloadPanesAndSyncActive,
  } = useSpacePane();

  const activeSpace = getActiveSpace();
  const [personalViewSpaceId, setPersonalViewSpaceId] = useState<string | null>(null);

  useEffect(() => {
    setPersonalViewSpaceId(null);
  }, [activeSpaceId]);

  const contentSpaceId = resolveContentSpaceId({
    shellSpaceType: activeSpace?.spaceType,
    shellSpaceId: activeSpaceId,
    personalViewSpaceId,
  });

  const contentSpace = useMemo(
    () => (contentSpaceId ? state.spaces.find((s) => s.id === contentSpaceId) ?? null : null),
    [state.spaces, contentSpaceId],
  );

  const isContentArchived = isSpaceArchivedReadOnly(contentSpace);

  const paneContext = useMemo((): PaneContext | null => {
    if (!activeSpaceId || !contextActivePaneId || !defaultPane) return null;
    return {
      spaceId: activeSpaceId,
      activePaneId: contextActivePaneId,
      defaultPaneId: defaultPane.id,
    };
  }, [activeSpaceId, contextActivePaneId, defaultPane]);

  const contentPaneContext = useMemo((): PaneContext | null => {
    if (personalViewSpaceId && contentSpaceId) {
      const defaultPaneId = defaultSpacePaneId(contentSpaceId);
      return {
        spaceId: contentSpaceId,
        activePaneId: defaultPaneId,
        defaultPaneId,
      };
    }
    return paneContext;
  }, [personalViewSpaceId, contentSpaceId, paneContext]);

  const connectionActivePaneId =
    contentPaneContext?.activePaneId ?? contextActivePaneId ?? defaultPane?.id ?? '';

  const screenQueryKey = useMemo(() => {
    if (!contentSpaceId || !contentPaneContext) return null;
    return buildQueryKeyV2(
      contentSpaceId,
      { kind: 'pane', paneId: contentPaneContext.activePaneId },
      displayPeriod,
    );
  }, [contentSpaceId, contentPaneContext, displayPeriod]);

  const resolveSpaceHossiis = useCallback(() => {
    if (!screenQueryKey) {
      if (contentSpaceId && contentSpaceId !== activeSpaceId) {
        return materializeHossiisArray(state.entities, contentSpaceId);
      }
      return getActiveSpaceHossiis();
    }
    const keyed = getHossiisForQueryKey(screenQueryKey);
    if (keyed.length > 0) return keyed;
    if (contentSpaceId && contentSpaceId !== activeSpaceId) {
      return materializeHossiisArray(state.entities, contentSpaceId);
    }
    return getActiveSpaceHossiis();
  }, [
    screenQueryKey,
    getHossiisForQueryKey,
    getActiveSpaceHossiis,
    contentSpaceId,
    activeSpaceId,
    state.entities,
  ]);

  const handleSpaceFetched = useCallback(
    (items: Hossii[], opts?: { merge?: boolean }) => {
      if (!screenQueryKey) return;
      syncFetchedHossiis(items, screenQueryKey, opts);
    },
    [screenQueryKey, syncFetchedHossiis],
  );

  const fetchProgress = useSpaceHossiiFetch({
    spaceId: contentSpaceId,
    displayLimit,
    displayPeriod,
    paneContext: contentPaneContext,
    enabled: !visitingSpaceId && isSupabaseConfigured && !panesLoading && contentPaneContext !== null,
    onFetched: handleSpaceFetched,
    onLoadingChange: setHossiiFetchLoading,
    getExistingHossiis: () => hossiisRef.current,
  });

  const showActiveSpaceUnavailableBanner = isActiveSpaceShellUnavailable({
    isSupabaseConfigured,
    spacesLoadedFromSupabase,
    activeSpaceId,
    hasActiveSpace: !!activeSpace,
  });
  const isVisiting = visitingSpaceId !== null;
  const { navigate } = useRouter();
  const { currentUser } = useAuth();
  const { memberships, selectedCommunityId } = useSelectedCommunity();
  const isAdmin = currentUser?.isAdmin ?? false;
  const isAuthenticated = !!currentUser;

  // 個人スペースショートカット（Pane ではなく UI ボタン）。
  // 正本は「現在表示中の shared space の community_id」で、localStorage 選択には依存しない。
  const spaceCommunityMembership = useMemo(() => {
    const communityId = activeSpace?.communityId;
    if (!communityId) return null;
    return memberships.find((m) => m.communityId === communityId) ?? null;
  }, [activeSpace?.communityId, memberships]);
  const personalShortcutEligible =
    isSharedSpaceShell(activeSpace?.spaceType) &&
    canShowPersonalShortcut({
      isAuthenticated,
      isVisiting,
      spaceCommunityId: activeSpace?.communityId,
      membershipStatus: spaceCommunityMembership?.status,
    });
  const personalShortcutActive =
    (personalViewSpaceId != null && isSharedSpaceShell(activeSpace?.spaceType)) ||
    isViewingOwnPersonalSpace({
      spaceType: activeSpace?.spaceType,
      spaceOwnerUserId: activeSpace?.ownerUserId,
      currentUserId: currentUser?.uid,
    });

  const postTargetOverride = useMemo(
    () => resolvePersonalPostTarget(personalViewSpaceId, defaultSpacePaneId),
    [personalViewSpaceId],
  );

  const postHossii = useCallback(
    (input: AddHossiiInput) => {
      if (isContentArchived) return;
      addHossii(applyPostTargetToInput(input, postTargetOverride));
    },
    [addHossii, postTargetOverride, isContentArchived],
  );

  const paneBarActivePaneId = personalViewSpaceId ? null : contextActivePaneId;

  const [activeBubbleId, setActiveBubbleId] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  // 他タブからのリアクションを受け取るための状態
  const [broadcastedReaction, setBroadcastedReaction] = useState<ReactionTrigger | null>(null);
  // 前回の latestHossii.id を追跡（新規投稿検出用）
  const prevLatestIdRef = useRef<string | null>(null);
  // モバイル判定とモーダル用の状態
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const isMobilePortrait = useMediaQuery('(max-width: 768px) and (orientation: portrait)');
  /** スマホ横持ち: 幅ではなく高さで判定（iPhone 14 横は幅 ~844px で 768px を超えるため） */
  const isMobileLandscape = useMediaQuery('(max-height: 600px) and (orientation: landscape)');
  const [presentationMode, setPresentationMode] = useState<PresentationMode>(() =>
    loadPresentationMode(),
  );
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(() =>
    activeSpace ? loadSpaceTagFilter(activeSpace.id) : null,
  );
  const [tagPanelOpen, setTagPanelOpen] = useState(false);
  const [modeTransitionPhase, setModeTransitionPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const [tagFilterPhase, setTagFilterPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const [hoveredHossiiId, setHoveredHossiiId] = useState<string | null>(null);
  const [hoverAnchorRect, setHoverAnchorRect] = useState<DOMRect | null>(null);
  const [pinHighlightId, setPinHighlightId] = useState<string | null>(null);
  const tagFilterButtonRef = useRef<HTMLButtonElement>(null);
  const hoverEnterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagFilterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const useStarView =
    (isMobile && isPortrait) ||
    (!isMobile && presentationMode === 'stars');
  const showStarToggle = !isMobile && viewMode !== 'slideshow';
  const renderAsStar = isMobile || presentationMode === 'stars';
  const showPcStarHover = !isMobile && presentationMode === 'stars';
  /** スマホ縦のみボトムシート。横持ち・PC は右サイドパネル */
  const useMobileBottomSheet = isMobile && isPortrait;
  const quickPostDefaultRect = useMemo(
    () => (useMobileBottomSheet ? getDefaultQuickPostBottomRect() : getDefaultQuickPostSideRect()),
    [useMobileBottomSheet]
  );
  const quickLogDefaultRect = useMemo(
    () => (useMobileBottomSheet ? getDefaultQuickLogBottomRect() : getDefaultQuickLogSideRect()),
    [useMobileBottomSheet]
  );
  const speechPanelFloating = useMemo(
    () =>
      isMobile
        ? {
            panelStorageKey: 'speech.mobile' as const,
            panelDefaultRect: getDefaultSpeechRectMobileMic(),
            panelMinW: 200,
            panelMinH: 200,
          }
        : {
            panelStorageKey: 'speech' as const,
            panelDefaultRect: getDefaultSpeechRect(),
            panelMinW: 280,
            panelMinH: 180,
          },
    [isMobile]
  );
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedAuthorGroup, setSelectedAuthorGroup] = useState<AuthorPostGroup | null>(null);
  const [hasMyHossiiRegistered, setHasMyHossiiRegistered] = useState(false);
  const [myHossiiParticipantEligibility, setMyHossiiParticipantEligibility] =
    useState<ParticipantEligibility>('not_participant');
  const [expandedClusterKeys, setExpandedClusterKeys] = useState<Set<string>>(new Set());
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

  // クイック投稿パネル（開閉とダブルタップ位置は別管理）
  const [quickPostOpen, setQuickPostOpen] = useState(false);
  /** ダブルタップで指定した論理座標（未指定時は id ベースのランダム配置） */
  const [quickPostPos, setQuickPostPos] = useState<{ x: number; y: number } | null>(null);
  /** PostScreen のフリー編集へ音声候補を渡す（`PostScreen` が登録） */
  const speechToFreePosterRef = useRef<((text: string) => void) | undefined>(undefined);
  /** ダブルクリック→クイック投稿オープンを遅延させ、トリプルクリックでログパネルに譲る */
  const pendingQuickPostOpenRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [qrPanelVisible, setQrPanelVisible] = useState(true);
  const [descriptionPanelVisible, setDescriptionPanelVisible] = useState(true);
  const [showPostCountBadge, setShowPostCountBadge] = useState(loadShowPostCountBadge);
  const [visitingToastVisible, setVisitingToastVisible] = useState(false);
  const [paneCreateOpen, setPaneCreateOpen] = useState(false);
  const [postSending, setPostSending] = useState(false);
  const [paneToastVisible, setPaneToastVisible] = useState(false);
  const [paneToastMessage, setPaneToastMessage] = useState('');
  const [paneToastType, setPaneToastType] = useState<'success' | 'error' | 'info'>('info');
  const [paneReorderBusy, setPaneReorderBusy] = useState(false);
  const prevActivePaneIdRef = useRef<string | null>(null);

  const storedTabFolders = useMemo(
    () => activeSpace?.tabFolders ?? [],
    [activeSpace?.tabFolders],
  );

  const persistTabFolders = useCallback(
    (next: TabFolder[]) => {
      if (!activeSpaceId) return;
      const normalized = normalizeStoredTabFolders(next);
      updateSpace(activeSpaceId, {
        tabFolders: normalized.length > 0 ? normalized : undefined,
      });
      clearLegacyLocalTabFolders(activeSpaceId);
    },
    [activeSpaceId, updateSpace],
  );

  useEffect(() => {
    if (!activeSpaceId) return;
    const migrated = migrateLegacyLocalTabFoldersIfNeeded(activeSpaceId, activeSpace?.tabFolders);
    if (migrated) {
      persistTabFolders(migrated);
    }
  }, [activeSpaceId, activeSpace?.tabFolders, persistTabFolders]);

  const effectiveFolders = useMemo(
    () => resolveEffectiveTabFolders(storedTabFolders, visiblePanes, { isAdmin }),
    [storedTabFolders, visiblePanes, isAdmin],
  );

  const tabSyncInput = useCallback(
    () => ({
      spaceId: activeSpaceId,
      space: activeSpace,
      visiblePanes,
      effectiveFolders,
    }),
    [activeSpaceId, activeSpace, visiblePanes, effectiveFolders],
  );

  useEffect(() => {
    if (!isAdmin || !activeSpaceId || panesLoading) return;
    logTabSyncDiagnostics(tabSyncInput());
    exposeTabSyncCheck(tabSyncInput);
  }, [isAdmin, activeSpaceId, panesLoading, tabSyncInput]);

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
    setQuickPostOpen(false);
    setQuickPostPos(null);
    resetQuickPostSpeechState();
  }, [resetQuickPostSpeechState]);

  useEffect(() => {
    if (!isContentArchived) return;
    if (quickPostOpen) handleQuickPostClose();
    if (speechPanelOpen) setSpeechPanelOpen(false);
  }, [isContentArchived, quickPostOpen, speechPanelOpen, handleQuickPostClose]);

  const handleQuickLogClose = useCallback(() => {
    setQuickLogOpen(false);
  }, []);

  const showPaneToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setPaneToastMessage(message);
      setPaneToastType(type);
      setPaneToastVisible(true);
    },
    [],
  );

  useEffect(() => {
    const onPostFailure = (event: Event) => {
      const detail = (event as CustomEvent<PostFailureDetail>).detail;
      if (detail?.message) {
        showPaneToast(formatPostFailureForDisplay(detail), 'error');
      }
    };
    window.addEventListener(POST_FAILURE_EVENT, onPostFailure);
    return () => window.removeEventListener(POST_FAILURE_EVENT, onPostFailure);
  }, [showPaneToast]);

  const showPaneBar =
    shouldShowSpacePaneBar(isAdmin, visiblePanes.length, isVisiting, panesLoading) ||
    // 個人スペースショートカットは Pane 数に関係なくタブ列へ表示するため、
    // 単一 Pane の共有スペースでもタブ列（＝ショートカットの器）を出す。
    (personalShortcutEligible && !isVisiting && !panesLoading);

  const demoTabSyncToastShownRef = useRef(false);
  useEffect(() => {
    if (
      demoTabSyncToastShownRef.current ||
      !isAdmin ||
      isSupabaseConfigured ||
      !showPaneBar ||
      isVisiting
    ) {
      return;
    }
    demoTabSyncToastShownRef.current = true;
    showPaneToast(
      'デモモード: タブはこのブラウザのみ保存され、デプロイ版とは連動しません',
      'info',
    );
  }, [isAdmin, isVisiting, showPaneBar, showPaneToast]);

  const handlePaneSelect = useCallback(
    (paneId: string) => {
      if (postSending) return;
      const leavingPersonal = personalViewSpaceId != null;
      if (leavingPersonal) {
        setPersonalViewSpaceId(null);
      }
      if (!leavingPersonal && paneId === contextActivePaneId) return;
      setActivePaneById(paneId);
    },
    [postSending, contextActivePaneId, personalViewSpaceId, setActivePaneById],
  );

  const handlePaneCreated = useCallback(
    async (pane: { id: string }) => {
      await reloadPanesAndSyncActive();
      setActivePaneById(pane.id);
      showPaneToast('タブを追加しました', 'success');
    },
    [reloadPanesAndSyncActive, setActivePaneById, showPaneToast],
  );

  const handlePaneReorder = useCallback(
    async (draggedId: string, insertBeforeIndex: number, stripId: string) => {
      const { barPanes, folderMap } = splitPanesByFolders(visiblePanes);
      const stripPanes = stripId === 'bar' ? barPanes : (folderMap.get(stripId) ?? []);
      const updates = computeVisiblePaneReorderUpdates(panes, stripPanes, draggedId, insertBeforeIndex);
      if (updates.length === 0) return;

      setPaneReorderBusy(true);
      try {
        const ok = await applySpacePaneSortOrders(updates, { allPanes: panes });
        if (!ok) {
          showPaneToast('並び替えに失敗しました', 'error');
          await reloadPanesAndSyncActive();
          return;
        }
        await reloadPanesAndSyncActive();
      } finally {
        setPaneReorderBusy(false);
      }
    },
    [panes, visiblePanes, reloadPanesAndSyncActive, showPaneToast],
  );

  const handleMoveToFolder = useCallback(
    async (paneId: string, folderId: string | null, insertBeforeBarIndex?: number) => {
      const pane = panes.find((p) => p.id === paneId);
      if (!pane) return;

      setPaneReorderBusy(true);
      try {
        const patch = buildTabFolderPatch(pane, folderId);
        const updated = await updateSpacePane(paneId, patch, { allPanes: panes });
        if (!updated) {
          showPaneToast('タブの移動に失敗しました', 'error');
          await reloadPanesAndSyncActive();
          return;
        }

        if (folderId === null && insertBeforeBarIndex != null) {
          const nextPanes = panes.map((p) => (p.id === paneId ? updated : p));
          const nextVisible = nextPanes.filter((p) => p.isVisible);
          const { barPanes } = splitPanesByFolders(nextVisible);
          const reorderUpdates = computeVisiblePaneReorderUpdates(
            nextPanes,
            barPanes,
            paneId,
            insertBeforeBarIndex,
          );
          if (reorderUpdates.length > 0) {
            const ok = await applySpacePaneSortOrders(reorderUpdates, { allPanes: nextPanes });
            if (!ok) {
              showPaneToast('並び替えに失敗しました', 'error');
              await reloadPanesAndSyncActive();
              return;
            }
          }
        }

        await reloadPanesAndSyncActive();
      } finally {
        setPaneReorderBusy(false);
      }
    },
    [panes, reloadPanesAndSyncActive, showPaneToast],
  );

  const handleAddFolder = useCallback((): string => {
    if (!activeSpaceId) return '';
    const id = `f${Date.now().toString(36)}`;
    const newFolder: TabFolder = { id, name: 'フォルダ', sortOrder: storedTabFolders.length };
    persistTabFolders([...storedTabFolders, newFolder]);
    return id;
  }, [activeSpaceId, persistTabFolders, storedTabFolders]);

  const handleRenameFolder = useCallback(
    (folderId: string, name: string) => {
      if (!activeSpaceId) return;
      const isDefault = folderId === DEFAULT_FOLDER_ID;
      const existing = storedTabFolders.find((f) => f.id === folderId);
      if (isDefault && !existing) {
        persistTabFolders([{ ...DEFAULT_FOLDER, name }, ...storedTabFolders]);
      } else {
        persistTabFolders(
          storedTabFolders.map((f) => (f.id === folderId ? { ...f, name } : f)),
        );
      }
    },
    [activeSpaceId, persistTabFolders, storedTabFolders],
  );

  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      if (!activeSpaceId) return;
      const folderPanes = panes.filter((p) => resolvePaneFolderId(p) === folderId);
      if (folderPanes.length > 0) {
        setPaneReorderBusy(true);
        try {
          for (const pane of folderPanes) {
            await updateSpacePane(pane.id, buildTabFolderPatch(pane, null), { allPanes: panes });
          }
          await reloadPanesAndSyncActive();
        } finally {
          setPaneReorderBusy(false);
        }
      }
      persistTabFolders(storedTabFolders.filter((f) => f.id !== folderId));
    },
    [activeSpaceId, panes, persistTabFolders, reloadPanesAndSyncActive, storedTabFolders],
  );

  const handleReorderFolder = useCallback(
    (draggedId: string, insertBeforeIndex: number) => {
      if (!activeSpaceId) return;
      const sorted = [...effectiveFolders].sort((a, b) => a.sortOrder - b.sortOrder);
      const reordered = reorderTabFolders(sorted, draggedId, insertBeforeIndex);
      if (!reordered) return;
      persistTabFolders(reordered);
    },
    [activeSpaceId, effectiveFolders, persistTabFolders],
  );

  useEffect(() => {
    const prev = prevActivePaneIdRef.current;
    if (
      prev != null &&
      contextActivePaneId != null &&
      prev !== contextActivePaneId &&
      quickPostOpen
    ) {
      handleQuickPostClose();
    }
    prevActivePaneIdRef.current = contextActivePaneId;
  }, [contextActivePaneId, quickPostOpen, handleQuickPostClose]);

  /** 投稿パネルを開く（位置未指定＝ランダム配置）／閉じる */
  const openQuickPost = useCallback(() => {
    if (isVisiting || isContentArchived) return;
    if (quickPostOpen) return;
    resetQuickPostSpeechState();
    setPostScreenKey((k) => k + 1);
    setQuickPostOpen(true);
  }, [isVisiting, isContentArchived, quickPostOpen, resetQuickPostSpeechState]);

  const handleQuickPostDockToggle = useCallback(() => {
    if (isVisiting || isContentArchived) return;
    if (quickPostOpen) {
      handleQuickPostClose();
      return;
    }
    openQuickPost();
  }, [isVisiting, isContentArchived, quickPostOpen, handleQuickPostClose, openQuickPost]);

  const handleTopRightPostClick = useCallback(() => {
    if (isVisiting) {
      setVisitingToastVisible(true);
      return;
    }
    if (isContentArchived) return;
    handleQuickPostDockToggle();
  }, [isVisiting, isContentArchived, handleQuickPostDockToggle]);

  useImperativeHandle(
    ref,
    () => ({
      toggleQuickPost: handleQuickPostDockToggle,
      openQuickPost,
      closeQuickPost: handleQuickPostClose,
    }),
    [handleQuickPostDockToggle, openQuickPost, handleQuickPostClose]
  );

  useEffect(() => {
    if (!pendingQuickPostOpen) return;
    if (!isVisiting) {
      openQuickPost();
    }
    onPendingQuickPostConsumed?.();
  }, [pendingQuickPostOpen, isVisiting, openQuickPost, onPendingQuickPostConsumed]);

  /**
   * クイック投稿パネル（ドックと同じトグル）
   * - Ctrl+N: Mac/Win でページに届き、抑止できる
   * - ⌘+⌥+N: Mac で ⌘+N がブラウザの「新しいウィンドウ」に取られるための代替（⌘+N 単体は登録しない）
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (isVisiting || isContentArchived) return;
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
  }, [isVisiting, isContentArchived, handleQuickPostDockToggle]);

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
    setQuickPostOpen(true);
  }, []);

  const dismissSpeechCandidate = useCallback((text: string) => {
    setDismissedSpeechCandidates((prev) => [...prev, text]);
  }, []);
  // モバイル: プレビュー表示するHossiiのID（6秒ごとにローテーション、最大3件）
  const [previewHossiiIds, setPreviewHossiiIds] = useState<Set<string>>(new Set());
  /** スマホ縦: 背景タップで壁紙を見やすくするモード */
  const [backgroundPeekMode, setBackgroundPeekMode] = useState(false);
  const backgroundPeekTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // F14: 選択中バブル
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);
  const [personalShortcutBusy, setPersonalShortcutBusy] = useState(false);

  // A02: 選択中の装飾（ポップアップ表示用）
  const [selectedDecorationId, setSelectedDecorationId] = useState<string | null>(null);

  // スペース設定（設定画面から戻ったときにフォーカスで再読み込み）
  const { spaceSettings } = useSpaceSettings(contentSpace ?? activeSpace);
  const likesEnabledForView = resolveLikesEnabledForArchivedSpace(
    isContentArchived,
    spaceSettings?.features.likesEnabled ?? true,
  );
  const { enabled: timelineDepthEnabled } = useTimelineDepthEnabled(
    contentSpaceId,
    contentSpace?.name ?? activeSpace?.name ?? '',
  );
  const timelineDepthActive = useMemo(
    () =>
      resolveTimelineDepthActive({
        enabled: timelineDepthEnabled,
        isMainPane: contentPaneContext != null && isDefaultPane(contentPaneContext),
        isStarMode: renderAsStar,
      }),
    [timelineDepthEnabled, contentPaneContext, renderAsStar],
  );
  const { pinnedIds, pinnedOrder, isPinned, toggle, unpin } = usePinnedHossiis(contentSpace?.id);
  const showPinUi = !isMobile;

  // 隣人スペース・訪問モード・漂着ボトル管理
  const {
    neighbors,
    visitingHossiis,
    visitingSpaceInfo,
    bottlePayload,
    setBottlePayload,
    handleIslandClick,
    removeVisitingHossii,
    patchVisitingHossiiLikeCount,
  } = useNeighborSpace({
    activeSpaceId,
    visitingSpaceId,
    isVisiting,
    spaceSettings,
    setVisitingSpace,
  });

  // 訪問中は背景・タイトル・装飾を訪問先に合わせる（投稿 0 件でも自スペースの見た目が残らないようにする）
  const spaceForVisual = useMemo(() => {
    if (isVisiting && visitingSpaceInfo) return visitingSpaceInfo;
    if (personalViewSpaceId && contentSpace) return contentSpace;
    return resolvePaneVisualSpace(activePane, activeSpace);
  }, [isVisiting, visitingSpaceInfo, personalViewSpaceId, contentSpace, activePane, activeSpace]);

  const spaceDescription = spaceForVisual?.description?.trim() ?? '';
  const hasDescription = spaceDescription.length > 0;

  const myHossiiEnabled = spaceForVisual?.myHossiiEnabled ?? false;
  const myHossiiMotionMode = spaceForVisual?.myHossiiMotionMode ?? 'auto';
  const myHossiiLogVisibility = spaceForVisual?.myHossiiLogVisibility ?? 'public';
  const showMyHossiiLayer = shouldShowMyHossiiLayer(
    myHossiiEnabled,
    personalViewSpaceId != null || activePane?.isDefault === true,
  );
  const allSpaceHossiisForMyHossii = useMemo(() => {
    if (!contentSpaceId) return [];
    return materializeHossiisArray(state.entities, contentSpaceId);
  }, [state.entities, contentSpaceId]);
  const spaceCharacterImageUrl = spaceForVisual?.characterImageUrl;

  useEffect(() => {
    if (!currentUser?.uid) {
      setHasMyHossiiRegistered(false);
      setMyHossiiParticipantEligibility('not_participant');
      return;
    }
    let cancelled = false;
    fetchMyHossiiSettings(currentUser.uid)
      .then((settings) => {
        if (!cancelled) {
          setHasMyHossiiRegistered(isMyHossiiRegistered(settings));
        }
      })
      .catch(() => {
        if (!cancelled) setHasMyHossiiRegistered(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser?.uid || !contentSpace?.id) {
      setMyHossiiParticipantEligibility('not_participant');
      return;
    }
    let cancelled = false;
    fetchParticipantEligibility(currentUser.uid, contentSpace.id, {
      legacyProfileId: state.profile?.id,
      defaultNickname: state.profile?.defaultNickname,
    })
      .then((eligibility) => {
        if (!cancelled) setMyHossiiParticipantEligibility(eligibility);
      })
      .catch(() => {
        if (!cancelled) setMyHossiiParticipantEligibility('error');
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid, contentSpace?.id, state.profile?.id, state.profile?.defaultNickname]);

  const resolvedBackground = useMemo(() => {
    if (isVisiting && visitingSpaceInfo) {
      return visitingSpaceInfo.background;
    }
    if (!isVisiting && activePane && activeSpace) {
      return resolvePaneBackground(activePane, activeSpace);
    }
    return spaceForVisual?.background;
  }, [isVisiting, visitingSpaceInfo, activePane, activeSpace, spaceForVisual]);

  // 背景スタイルを生成（Pane 切替時は resolvePaneBackground、訪問中は visitingSpaceInfo）
  const { backgroundClass, backgroundStyle, imageWallpaperUrl } = useMemo(() => {
    const bg = resolvedBackground;
    if (!bg) {
      return {
        backgroundClass: `${bgStyles.bgBase} ${bgStyles.pattern_mist}`,
        backgroundStyle: {},
        imageWallpaperUrl: null as string | null,
      };
    }

    if (bg.kind === 'color') {
      return {
        backgroundClass: bgStyles.bgBase,
        backgroundStyle: { backgroundColor: bg.value },
        imageWallpaperUrl: null as string | null,
      };
    }

    if (bg.kind === 'pattern') {
      const patternClass = bgStyles[`pattern_${bg.value}`] || bgStyles.pattern_mist;
      return {
        backgroundClass: `${bgStyles.bgBase} ${patternClass}`,
        backgroundStyle: {},
        imageWallpaperUrl: null as string | null,
      };
    }

    if (bg.kind === 'image') {
      return {
        backgroundClass: `${bgStyles.bgBase}`,
        backgroundStyle: {
          backgroundColor: SPACE_IMAGE_LETTERBOX_COLOR,
        },
        imageWallpaperUrl: bg.value,
      };
    }

    return {
      backgroundClass: `${bgStyles.bgBase} ${bgStyles.pattern_mist}`,
      backgroundStyle: {},
      imageWallpaperUrl: null as string | null,
    };
  }, [resolvedBackground]);

  const shouldMapToSharp = isMobile && imageWallpaperUrl != null;

  const [likeReactionTrigger, setLikeReactionTrigger] = useState<{ id: string } | null>(null);

  const handleLike = useCallback(async (hossiiId: string): Promise<LikeMutationResult> => {
    if (isContentArchived) {
      throw new Error('[SpaceScreen] likes disabled for archived content');
    }
    try {
      const result = await mutateLike(hossiiId, currentUser?.uid);
      updateHossiiLikeCountAction(hossiiId, result.likeCount);
      if (isVisiting) {
        patchVisitingHossiiLikeCount(hossiiId, result.likeCount);
      }
      if (result.liked) {
        setLikeReactionTrigger({ id: `like-${hossiiId}-${Date.now()}` });
      }
      return result;
    } catch (err) {
      console.error('[SpaceScreen] mutateLike error:', err);
      throw err;
    }
  }, [
    isContentArchived,
    currentUser?.uid,
    updateHossiiLikeCountAction,
    isVisiting,
    patchVisitingHossiiLikeCount,
  ]);

  /** アプリ内「大画面」— 見た目の最大化（Fullscreen API は補助） */
  const [immersiveLayout, setImmersiveLayout] = useState(false);
  /** ブラウザ全画面の対象（documentElement ではなくスペースコンテナ、仕様71） */
  const spaceImmersiveRootRef = useRef<HTMLDivElement | null>(null);
  /** 音声パネル用ポータル先（スペースルート＝Fullscreen API の舞台と一致させる） */
  const [speechPanelPortalEl, setSpeechPanelPortalEl] = useState<HTMLElement | null>(null);
  const attachSpaceRoot = useCallback((node: HTMLDivElement | null) => {
    spaceImmersiveRootRef.current = node;
    setSpeechPanelPortalEl(node);
  }, []);

  // PC版コントロールバーの状態管理
  const [controlState, setControlState] = useState<ControlState>({
    isFullscreen: false,
    hossiiVisible: showHossii,
    micEnabled: listenMode,
    voiceEnabled,
  });

  // ストアの showHossii / listenMode が変わったら controlState に同期
  useEffect(() => {
    setControlState((prev) => ({ ...prev, hossiiVisible: showHossii }));
  }, [showHossii]);

  useEffect(() => {
    setControlState((prev) => ({ ...prev, micEnabled: listenMode }));
  }, [listenMode]);

  useEffect(() => {
    setControlState((prev) => ({ ...prev, voiceEnabled }));
  }, [voiceEnabled]);

  useEffect(() => {
    setControlState((prev) => ({ ...prev, isFullscreen: immersiveLayout }));
  }, [immersiveLayout]);

  // 没入モードに合わせてブラウザ全画面を試みる / 終了（モバイルは CSS のみ、仕様71）
  useEffect(() => {
    if (!immersiveLayout) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      return;
    }
    if (isMobile) {
      return;
    }
    const el = spaceImmersiveRootRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) return;
    el.requestFullscreen().catch(() => {
      /* 未対応・拒否 — レイアウトのみで継続 */
    });
  }, [immersiveLayout, isMobile]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setImmersiveLayout(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // 同意モーダル表示フラグ
  const [showListenConsent, setShowListenConsent] = useState(false);
  const [showVoiceConsent, setShowVoiceConsent] = useState(false);

  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-hossii-bubble]')) return;

    // スマホ縦: 背景シングルタップで壁紙ピークモード（ダブルタップ投稿と競合しないよう遅延）
    if (isMobile && isPortrait && e.detail === 1) {
      if (backgroundPeekTapTimerRef.current) {
        clearTimeout(backgroundPeekTapTimerRef.current);
      }
      backgroundPeekTapTimerRef.current = setTimeout(() => {
        backgroundPeekTapTimerRef.current = null;
        setBackgroundPeekMode((v) => !v);
      }, 300);
      return;
    }

    if (isMobile) return;
    if (e.detail !== 3) return;
    if (pendingQuickPostOpenRef.current) {
      clearTimeout(pendingQuickPostOpenRef.current);
      pendingQuickPostOpenRef.current = null;
    }
    setQuickLogOpen((v) => !v);
  }, [isMobile, isPortrait]);

  useEffect(() => {
    if (isVisiting && quickPostOpen) {
      setQuickPostOpen(false);
      setQuickPostPos(null);
      resetQuickPostSpeechState();
    }
  }, [isVisiting, quickPostOpen, resetQuickPostSpeechState]);

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
    } else if (key === 'voiceEnabled') {
      if (voiceEnabled) {
        setVoiceEnabled(false);
      } else if (hasConsentedToVoice) {
        setVoiceEnabled(true);
      } else {
        setShowVoiceConsent(true);
      }
    } else {
      // isFullscreen はローカル state のみ管理
      setControlState((prev) => ({ ...prev, [key]: !prev[key] }));
    }
  }, [showHossii, listenMode, hasConsentedToListen, voiceEnabled, hasConsentedToVoice, setShowHossii, setListenMode, setVoiceEnabled]);

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
    setImmersiveLayout((v) => !v);
  }, []);

  // DisplayScale を循環させる（75% → 100% → 125% → 150% → 75%...）
  const handleDisplayScaleCycle = useCallback(() => {
    const scales = DISPLAY_SCALE_VALUES;
    const currentIndex = scales.indexOf(displayScale);
    const nextIndex = (currentIndex + 1) % scales.length;
    setDisplayScale(scales[nextIndex]);
  }, [displayScale, setDisplayScale]);

  // F02/F04: バブル編集権限チェック（Identity A: 本人性は authorship を正本とする）
  const canEditBubble = useCallback(
    (hossii: { id: string; authorId?: string }) =>
      resolveBubbleCanEditForArchivedSpace(
        isContentArchived,
        resolveCanEditBubble({
          isAdmin,
          bubbleEditPermission: spaceSettings?.bubbleEditPermission,
          hossiiId: hossii.id,
          hossiiAuthorId: hossii.authorId,
          isAuthenticated,
          guestAuthorId: state.profile?.id,
          myAuthorshipIds,
          myAuthorshipIdsStatus,
        }),
      ),
    [
      isContentArchived,
      isAdmin,
      spaceSettings,
      isAuthenticated,
      state.profile?.id,
      myAuthorshipIds,
      myAuthorshipIdsStatus,
    ],
  );

  // ===== F14: 選択ハンドラ =====
  const handleBubbleSelect = useCallback((id: string) => {
    setSelectedBubbleId(id);
  }, []);

  const handleBubbleDeselect = useCallback(() => {
    setSelectedBubbleId(null);
  }, []);

  const handlePersonalShortcut = useCallback(async () => {
    const communityId = activeSpace?.communityId;
    if (!communityId || personalShortcutBusy || !isSharedSpaceShell(activeSpace?.spaceType)) return;
    if (personalViewSpaceId) return;
    setPersonalShortcutBusy(true);
    try {
      const existingPersonal = state.spaces.find(
        (s) =>
          s.spaceType === 'personal' &&
          s.communityId === communityId &&
          s.ownerUserId === currentUser?.uid,
      );
      if (existingPersonal) {
        setPersonalViewSpaceId(existingPersonal.id);
        return;
      }
      const res = await ensureMyPersonalSpace(communityId);
      if (!res.ok) {
        showPaneToast(res.message, 'error');
        return;
      }
      const existing = state.spaces.find((s) => s.id === res.spaceId);
      if (!existing) {
        const fetched = res.spaceUrl ? await fetchSpaceByUrl(res.spaceUrl) : null;
        if (fetched) {
          addSpaceLocal(fetched);
        } else {
          showPaneToast(MY_SPACE_OPEN_ERROR, 'error');
          return;
        }
      }
      setPersonalViewSpaceId(res.spaceId);
    } catch {
      showPaneToast(MY_SPACE_OPEN_ERROR, 'error');
    } finally {
      setPersonalShortcutBusy(false);
    }
  }, [
    activeSpace?.communityId,
    activeSpace?.spaceType,
    addSpaceLocal,
    currentUser?.uid,
    personalShortcutBusy,
    personalViewSpaceId,
    showPaneToast,
    state.spaces,
  ]);

  const personalShortcut = useMemo(() => {
    if (!personalShortcutEligible) return null;
    return {
      label: 'マイスペース',
      loading: personalShortcutBusy,
      active: personalShortcutActive,
      onClick: () => void handlePersonalShortcut(),
    };
  }, [personalShortcutEligible, personalShortcutActive, handlePersonalShortcut, personalShortcutBusy]);

  // F06: 非表示（管理者のみ）
  const handleHideBubble = useCallback(() => {
    if (isContentArchived) return;
    if (!selectedBubbleId) return;
    hideHossii(selectedBubbleId);
    setSelectedBubbleId(null);
  }, [isContentArchived, selectedBubbleId, hideHossii]);

  // F05: PointerUp で即座にスケール保存
  const handleScaleSave = useCallback((id: string, scale: number) => {
    if (isContentArchived) return;
    updateHossiiScaleAction(id, scale);
  }, [isContentArchived, updateHossiiScaleAction]);

  // F01: カラー選択で即座に保存
  const handleColorSave = useCallback((id: string, color: string | null) => {
    if (isContentArchived) return;
    updateHossiiColorAction(id, color);
  }, [isContentArchived, updateHossiiColorAction]);

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
    activeSpaceId: contentSpaceId ?? activeSpaceId ?? '',
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
    enabled: voiceEnabled,
  });

  // 訪問モード中は訪問先 hossiis を使用、それ以外は自スペース（default pane v2 key）
  const hossiis = isVisiting ? visitingHossiis : resolveSpaceHossiis();

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

  const pipeline = useMemo(
    () =>
      runDisplayPipeline({
        hossiis,
        displayPeriod,
        displayLimit,
        viewMode,
        activeTagFilter,
      }),
    [hossiis, displayPeriod, displayLimit, viewMode, activeTagFilter],
  );

  const { filteredHossiis, tagCounts } = pipeline;

  const visibleHossiiIds = useMemo(
    () => new Set(filteredHossiis.map((h) => h.id)),
    [filteredHossiis],
  );

  const devMockConnections = useMemo(() => {
    const spaceId = contentSpaceId ?? activeSpaceId ?? '';
    if (!spaceId || !connectionActivePaneId) return [];
    return buildDevMockHossiiConnections(
      spaceId,
      connectionActivePaneId,
      filteredHossiis.map((h) => h.id),
    );
  }, [contentSpaceId, activeSpaceId, connectionActivePaneId, filteredHossiis]);

  // 吹き出しごとに本人操作（編集/公開範囲/削除）を出せるか。
  // authorship を正本にし、ゲスト投稿・他人投稿・authorship 未確定では出さない。
  // presentationMode に依存せず、custom / ordered / random すべてで機能する。
  const canManageOwnHossii = useCallback(
    (hossiiId: string) =>
      resolveCanManageOwnForArchivedSpace(
        isContentArchived,
        canManageOwnPost({
          isAuthenticated: !!currentUser,
          myAuthorshipIds,
          myAuthorshipIdsStatus,
          hossiiId,
        }),
      ),
    [isContentArchived, currentUser, myAuthorshipIds, myAuthorshipIdsStatus],
  );

  const pinnedHossiisForTray = useMemo(() => {
    const byId = new Map(filteredHossiis.map((h) => [h.id, h]));
    return pinnedOrder
      .map((id) => byId.get(id))
      .filter((h): h is Hossii => h != null);
  }, [filteredHossiis, pinnedOrder]);

  const handlePinToggle = useCallback(
    (id: string) => {
      toggle(id);
      if (hoveredHossiiId === id) {
        if (hoverEnterTimerRef.current) clearTimeout(hoverEnterTimerRef.current);
        if (hoverLeaveTimerRef.current) clearTimeout(hoverLeaveTimerRef.current);
        setHoveredHossiiId(null);
        setHoverAnchorRect(null);
      }
    },
    [toggle, hoveredHossiiId],
  );

  const handlePinHighlight = useCallback((id: string) => {
    if (pinHighlightTimerRef.current) clearTimeout(pinHighlightTimerRef.current);
    setPinHighlightId(id);
    pinHighlightTimerRef.current = setTimeout(() => {
      setPinHighlightId(null);
      pinHighlightTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    if (!contentSpace?.id) return;
    setActiveTagFilter(loadSpaceTagFilter(contentSpace.id));
  }, [contentSpace?.id]);

  const tagCandidates = useMemo(() => {
    const fromPosts = [...tagCounts.keys()];
    const presetOrder = contentSpace?.presetTags ?? [];
    const presetInPosts = presetOrder.filter((t) => fromPosts.includes(t));
    const rest = fromPosts
      .filter((t) => !presetOrder.includes(t))
      .sort((a, b) => (tagCounts.get(b) ?? 0) - (tagCounts.get(a) ?? 0));
    return [...presetInPosts, ...rest];
  }, [contentSpace?.presetTags, tagCounts]);

  const showTagControls = viewMode !== 'slideshow' && (tagCandidates.length > 0 || activeTagFilter != null);

  const applyTagFilter = useCallback(
    (tag: string | null) => {
      const runFilter = () => {
        setActiveTagFilter(tag);
        if (contentSpace?.id) saveSpaceTagFilter(contentSpace.id, tag);
        setTagPanelOpen(false);
      };
      if (prefersReducedMotion) {
        runFilter();
        return;
      }
      setTagFilterPhase('out');
      if (tagFilterTimerRef.current) clearTimeout(tagFilterTimerRef.current);
      tagFilterTimerRef.current = setTimeout(() => {
        runFilter();
        setTagFilterPhase('in');
        tagFilterTimerRef.current = setTimeout(() => setTagFilterPhase('idle'), 250);
      }, 200);
    },
    [contentSpace?.id, prefersReducedMotion],
  );

  const handleStarToggle = useCallback(() => {
    const next: PresentationMode = presentationMode === 'stars' ? 'custom' : 'stars';
    const commit = () => {
      setPresentationMode(next);
      savePresentationMode(next);
      setHoveredHossiiId(null);
      setHoverAnchorRect(null);
    };
    if (prefersReducedMotion) {
      commit();
      return;
    }
    setModeTransitionPhase('out');
    if (modeTransitionTimerRef.current) clearTimeout(modeTransitionTimerRef.current);
    modeTransitionTimerRef.current = setTimeout(() => {
      commit();
      setModeTransitionPhase('in');
      modeTransitionTimerRef.current = setTimeout(() => setModeTransitionPhase('idle'), 250);
    }, 200);
  }, [presentationMode, prefersReducedMotion]);

  const hasInlineStarPreview = useCallback(
    (hossiiId: string) => isPinned(hossiiId) || previewHossiiIds.has(hossiiId),
    [isPinned, previewHossiiIds],
  );

  const handleStarMouseEnter = useCallback(
    (hossiiId: string, e: React.MouseEvent) => {
      if (!useStarView || hasInlineStarPreview(hossiiId)) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (hoverLeaveTimerRef.current) clearTimeout(hoverLeaveTimerRef.current);
      if (hoverEnterTimerRef.current) clearTimeout(hoverEnterTimerRef.current);
      hoverEnterTimerRef.current = setTimeout(() => {
        setHoveredHossiiId(hossiiId);
        setHoverAnchorRect(rect);
      }, 50);
    },
    [useStarView, hasInlineStarPreview],
  );

  const scheduleHoverDismiss = useCallback(() => {
    if (hoverEnterTimerRef.current) clearTimeout(hoverEnterTimerRef.current);
    if (hoverLeaveTimerRef.current) clearTimeout(hoverLeaveTimerRef.current);
    hoverLeaveTimerRef.current = setTimeout(() => {
      setHoveredHossiiId(null);
      setHoverAnchorRect(null);
    }, 200);
  }, []);

  const handleStarMouseLeave = useCallback(() => {
    scheduleHoverDismiss();
  }, [scheduleHoverDismiss]);

  const handlePreviewMouseEnter = useCallback(() => {
    if (hoverLeaveTimerRef.current) clearTimeout(hoverLeaveTimerRef.current);
  }, []);

  const handlePreviewMouseLeave = useCallback(() => {
    scheduleHoverDismiss();
  }, [scheduleHoverDismiss]);

  const handleStarClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const id = e.currentTarget.dataset.hossiiId;
    if (id) setSelectedPostId(id);
  }, []);

  const handleStarMouseEnterStable = useCallback(
    (e: React.MouseEvent) => {
      const id = (e.currentTarget as HTMLElement).dataset.hossiiId;
      if (id) handleStarMouseEnter(id, e);
    },
    [handleStarMouseEnter],
  );

  useEffect(() => {
    return () => {
      if (hoverEnterTimerRef.current) clearTimeout(hoverEnterTimerRef.current);
      if (hoverLeaveTimerRef.current) clearTimeout(hoverLeaveTimerRef.current);
      if (modeTransitionTimerRef.current) clearTimeout(modeTransitionTimerRef.current);
      if (tagFilterTimerRef.current) clearTimeout(tagFilterTimerRef.current);
      if (pinHighlightTimerRef.current) clearTimeout(pinHighlightTimerRef.current);
    };
  }, []);

  const canSpaceExportByPermission = resolveCanvasExportAllowed(isAdmin);

  const spaceExportRootRef = useRef<HTMLDivElement>(null);
  const bubbleAreaRef = useRef<HTMLDivElement | null>(null);
  const spaceTitleRowRef = useRef<HTMLDivElement>(null);
  const mobilePaneBarRef = useRef<HTMLElement>(null);
  const { containerW, containerH, sharpRect, observeRef: observeBubbleArea } = useSharpContentRect();
  const mergeBubbleAreaRef = useCallback(
    (node: HTMLDivElement | null) => {
      bubbleAreaRef.current = node;
      observeBubbleArea(node);
    },
    [observeBubbleArea],
  );

  const mapDisplayPos = useCallback(
    (pos: { x: number; y: number }) => {
      if (shouldMapToSharp && containerW > 0 && containerH > 0) {
        return mapLogicalToContainerPercent(pos.x, pos.y, containerW, containerH);
      }
      return pos;
    },
    [shouldMapToSharp, containerW, containerH],
  );

  const toStoragePos = useCallback(
    (display: { x: number; y: number }) => {
      if (shouldMapToSharp && containerW > 0 && containerH > 0) {
        return mapContainerPercentToLogical(display.x, display.y, containerW, containerH);
      }
      return display;
    },
    [shouldMapToSharp, containerW, containerH],
  );

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-hossii-bubble]')) return;
    if (backgroundPeekTapTimerRef.current) {
      clearTimeout(backgroundPeekTapTimerRef.current);
      backgroundPeekTapTimerRef.current = null;
    }
    if (isVisiting || isContentArchived) return;
    if (quickPostOpen) {
      handleQuickPostClose();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * 100;
    const cy = ((e.clientY - rect.top) / rect.height) * 100;
    const savedPos =
      shouldMapToSharp && rect.width > 0 && rect.height > 0
        ? mapContainerPercentToLogical(cx, cy, rect.width, rect.height)
        : { x: cx, y: cy };
    resetQuickPostSpeechState();
    setPostScreenKey((k) => k + 1);
    pendingQuickPostOpenRef.current = setTimeout(() => {
      pendingQuickPostOpenRef.current = null;
      setQuickPostOpen(true);
      setQuickPostPos(savedPos);
    }, 320);
  }, [isVisiting, isContentArchived, quickPostOpen, resetQuickPostSpeechState, shouldMapToSharp, handleQuickPostClose]);

  const handlePositionSave = useCallback(
    (id: string, x: number, y: number) => {
      if (isContentArchived) return;
      const saved = toStoragePos({ x, y });
      updateHossiiPositionAction(id, saved.x, saved.y);
    },
    [isContentArchived, toStoragePos, updateHossiiPositionAction],
  );

  const spaceExportAbortRef = useRef<AbortController | null>(null);
  const [spaceExportBusy, setSpaceExportBusy] = useState(false);
  /** 書き出し前設定モーダルの表示フラグ */
  const [spaceExportModalOpen, setSpaceExportModalOpen] = useState(false);

  const spaceExportBlockedUI = useMemo(
    () =>
      !!(
        selectedPostId ||
        selectedAuthorGroup ||
        showListenConsent ||
        showVoiceConsent ||
        quickPostOpen ||
        quickLogOpen ||
        speechPanelOpen ||
        selectedDecorationId
      ),
    [
      selectedPostId,
      selectedAuthorGroup,
      showListenConsent,
      showVoiceConsent,
      quickPostOpen,
      quickLogOpen,
      speechPanelOpen,
      selectedDecorationId,
    ],
  );

  const showSpaceExportButton =
    canSpaceExportByPermission &&
    !isVisiting &&
    viewMode !== 'slideshow' &&
    hossiiLoadedFromSupabase;

  const spaceExportButtonTitle = useMemo(() => {
    if (spaceExportBusy) return '書き出し処理中です';
    if (spaceExportBlockedUI) {
      return 'パネルやモーダルを閉じてから書き出せます';
    }
    if (filteredHossiis.length > SPACE_EXPORT_MAX_BUBBLES) {
      return `表示中の投稿が多すぎます（上限 ${SPACE_EXPORT_MAX_BUBBLES} 件）`;
    }
    return 'スペースを画像（PNG）で書き出し';
  }, [spaceExportBusy, spaceExportBlockedUI, filteredHossiis.length]);

  const handleSpaceExportCancel = useCallback(() => {
    spaceExportAbortRef.current?.abort();
  }, []);

  const handleSpaceExport = useCallback(async () => {
    if (!showSpaceExportButton || spaceExportBlockedUI) return;
    const root = spaceExportRootRef.current;
    const space = contentSpace ?? activeSpace;
    if (!root || !space) return;

    spaceExportAbortRef.current?.abort();
    const ac = new AbortController();
    spaceExportAbortRef.current = ac;

    setSelectedBubbleId(null);
    setSpaceExportBusy(true);
    try {
      await waitForDoubleRaf();
      if (ac.signal.aborted) return;

      const shareUrl = buildSpaceShareUrl({
        origin: window.location.origin,
        communitySlug,
        spaceURL: space.spaceURL,
        activeSpaceId: space.id,
      });
      const spaceTitle = space.name;
      const blob = await exportSpaceCanvasWithFrame({
        element: root,
        signal: ac.signal,
        bubbleCount: filteredHossiis.length,
        shareUrl,
        spaceTitle,
        exportedAt: new Date(),
      });
      if (ac.signal.aborted) return;
      const slug = space.spaceURL ?? space.id;
      const datePart = new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .format(new Date())
        .replace(/\//g, '-');
      const filename = buildSpaceExportFilename(
        [spaceTitle, datePart, slug],
        'png',
      );
      downloadSpaceExportBlob(blob, filename);
    } catch (e) {
      if (e instanceof SpaceExportError && e.code === 'aborted') return;
      const msg =
        e instanceof SpaceExportError ? e.message : '書き出しに失敗しました';
      window.alert(msg);
    } finally {
      if (spaceExportAbortRef.current === ac) {
        spaceExportAbortRef.current = null;
      }
      setSpaceExportBusy(false);
    }
  }, [
    showSpaceExportButton,
    spaceExportBlockedUI,
    contentSpace,
    activeSpace,
    communitySlug,
    filteredHossiis.length,
  ]);

  // 画面上の一覧は新しい順なので、先頭 N 件を「直近投稿」として視覚的に強調する
  const RECENT_HIGHLIGHT_COUNT = 5;
  const recentHighlightIds = useMemo(
    () => new Set(filteredHossiis.slice(0, RECENT_HIGHLIGHT_COUNT).map((h) => h.id)),
    [filteredHossiis]
  );

  // 各バブルの位置を事前計算（メモ化）
  const authorGroups = useMemo(() => {
    if (layoutMode !== 'byAuthor') return [];
    return sortAuthorGroups(groupHossiisByAuthor(filteredHossiis), authorGroupSort);
  }, [filteredHossiis, layoutMode, authorGroupSort]);

  const positionCacheRef = useRef<PositionCache>({});

  const { positionsByHossiiId, authorClusterPositions } = useMemo(() => {
    const result = computeBubblePositions({
      filteredHossiis,
      authorGroupCount: authorGroups.length,
      layoutMode,
      shouldMapToSharp,
      orderedSortDirection,
      cache: positionCacheRef.current,
    });
    positionCacheRef.current = result.positionsByHossiiId;
    return result;
  }, [filteredHossiis, authorGroups.length, layoutMode, shouldMapToSharp, orderedSortDirection]);

  const awaitingFirstHossiis =
    panesLoading || paneContext === null || !hossiiLoadedFromSupabase;

  const showInitialLoadingOverlay =
    !showActiveSpaceUnavailableBanner &&
    filteredHossiis.length === 0 &&
    awaitingFirstHossiis;

  const welcomeGuideSpaceKey = contentSpaceId ?? activeSpaceId ?? '';
  const [welcomeGuideDismissed, setWelcomeGuideDismissed] = useState(false);
  const [welcomeGuideForceOpen, setWelcomeGuideForceOpen] = useState(false);
  const [welcomeGuideSeenInStorage, setWelcomeGuideSeenInStorage] = useState(() =>
    welcomeGuideSpaceKey ? hasSeenSpaceGuide(welcomeGuideSpaceKey) : true,
  );

  useEffect(() => {
    setWelcomeGuideDismissed(false);
    setWelcomeGuideForceOpen(false);
    setWelcomeGuideSeenInStorage(
      welcomeGuideSpaceKey ? hasSeenSpaceGuide(welcomeGuideSpaceKey) : true,
    );
  }, [welcomeGuideSpaceKey]);

  const welcomeGuideNickname = getActiveNickname().trim();
  const welcomeGuideDescription = spaceForVisual?.description?.trim() || undefined;
  const welcomeGuideInteractionHint = isMobile
    ? '画面をダブルタップするか、\n下の「投稿」から投稿できるよ。'
    : '画面をダブルクリックするか、\n右上の「投稿する」から投稿できるよ。';

  const welcomeGuideAllowed =
    !!welcomeGuideSpaceKey &&
    !isVisiting &&
    !isContentArchived &&
    viewMode !== 'slideshow' &&
    !showInitialLoadingOverlay;

  const welcomeGuideEligible =
    welcomeGuideAllowed && !welcomeGuideDismissed && !welcomeGuideSeenInStorage;

  const showWelcomeGuide =
    welcomeGuideAllowed && (welcomeGuideForceOpen || welcomeGuideEligible);

  const handleOpenWelcomeGuide = useCallback(() => {
    if (!welcomeGuideAllowed) return;
    setWelcomeGuideForceOpen(true);
    setWelcomeGuideDismissed(false);
  }, [welcomeGuideAllowed]);

  const handleWelcomeGuideClose = useCallback(() => {
    setWelcomeGuideForceOpen(false);
    setWelcomeGuideDismissed(true);
    if (welcomeGuideSpaceKey && !welcomeGuideSeenInStorage) {
      markSpaceGuideSeen(welcomeGuideSpaceKey);
      setWelcomeGuideSeenInStorage(true);
    }
  }, [welcomeGuideSpaceKey, welcomeGuideSeenInStorage]);

  const showByAuthorLoadingOverlay =
    layoutMode === 'byAuthor' &&
    displayLimit === 'unlimited' &&
    !fetchProgress.fetchComplete &&
    isSupabaseConfigured &&
    !isVisiting &&
    !showInitialLoadingOverlay;

  const showFetchLoadingBadge =
    fetchProgress.loading &&
    displayLimit === 'unlimited' &&
    !isVisiting &&
    !showInitialLoadingOverlay;

  const guideDisplayReady =
    !showActiveSpaceUnavailableBanner &&
    !showInitialLoadingOverlay &&
    !awaitingFirstHossiis;

  const { guideMessage, dismissGuide } = useHossiiGuideBubble({
    spaceId: contentSpace?.id ?? activeSpace?.id,
    hossiiGuide: spaceSettings?.hossiiGuide,
    displayReady: guideDisplayReady,
    blocked: !guideDisplayReady || showByAuthorLoadingOverlay,
  });

  const toggleClusterExpand = useCallback((groupKey: string) => {
    setExpandedClusterKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, []);

  useEffect(() => {
    if (layoutMode !== 'byAuthor') {
      setExpandedClusterKeys(new Set());
      setSelectedAuthorGroup(null);
    }
  }, [layoutMode]);

  const postsWithContentCount = useMemo(
    () => filteredHossiis.filter((h) => h.message || h.imageUrl).length,
    [filteredHossiis],
  );

  const previewSlotCount = useMemo(
    () =>
      computePreviewSlotCount({
        layoutMode,
        useStarView,
        postsWithContentCount,
        isMobile,
        isPortrait,
        presentationMode,
      }),
    [layoutMode, useStarView, postsWithContentCount, isMobile, isPortrait, presentationMode],
  );

  // 星プレビュー吹き出しをランダムローテ（6秒ごと）
  useEffect(() => {
    if (previewSlotCount === 0) {
      setPreviewHossiiIds(new Set());
      return;
    }
    const postsWithContent = filteredHossiis.filter(
      (h) => (h.message || h.imageUrl) && !pinnedIds.has(h.id),
    );
    const pick = () => {
      const shuffled = [...postsWithContent].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, previewSlotCount).map((h) => h.id);
      setPreviewHossiiIds(new Set(picked));
    };
    pick();
    const interval = setInterval(pick, 6000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewSlotCount, filteredHossiis.length, pinnedIds]);

  useEffect(() => {
    if (!isMobilePortrait) setBackgroundPeekMode(false);
  }, [isMobilePortrait]);

  useEffect(() => {
    return () => {
      if (backgroundPeekTapTimerRef.current) {
        clearTimeout(backgroundPeekTapTimerRef.current);
      }
    };
  }, []);

  // 最新の投稿（HossiiLive用）
  const latestHossii = filteredHossiis[0] ?? null;

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

  // モバイルモーダル用の選択された投稿
  const selectedPost = selectedPostId
    ? filteredHossiis.find(h => h.id === selectedPostId)
    : null;

  // クイックログパネル: 画面上のスペース（訪問中は隣人）と一覧を揃える
  const logListSpaceId = isVisiting ? visitingSpaceId : contentSpaceId;
  const logListHossiis = isVisiting ? visitingHossiis : resolveSpaceHossiis();
  const logPresetTags =
    isVisiting && visitingSpaceInfo
      ? visitingSpaceInfo.presetTags ?? []
      : activeSpace?.presetTags ?? [];

  // ダブルタップ投稿ヒント: スマホ縦でパネルが閉じている間だけ表示
  const showDoubleTapHint =
    isMobilePortrait &&
    !isVisiting &&
    !isContentArchived &&
    !quickPostOpen &&
    viewMode !== 'slideshow';

  /** タイトル行・タブバーの下端（bubbleArea 基準 px）。ヒントを上バーと被らせない */
  const [minHintTopPx, setMinHintTopPx] = useState(100);

  useLayoutEffect(() => {
    if (!showDoubleTapHint) return;

    const measure = () => {
      const areaTop = bubbleAreaRef.current?.getBoundingClientRect().top ?? 0;
      let chromeBottom = 0;

      const title = spaceTitleRowRef.current;
      if (title) {
        chromeBottom = Math.max(chromeBottom, title.getBoundingClientRect().bottom - areaTop);
      }
      const bar = mobilePaneBarRef.current;
      if (bar) {
        chromeBottom = Math.max(chromeBottom, bar.getBoundingClientRect().bottom - areaTop);
      }

      setMinHintTopPx(chromeBottom > 0 ? chromeBottom + 8 : 100);
    };

    measure();
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    for (const el of [bubbleAreaRef.current, spaceTitleRowRef.current, mobilePaneBarRef.current]) {
      if (el) ro.observe(el);
    }
    return () => {
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, [showDoubleTapHint, showPaneBar, effectiveFolders.length, hasDescription]);

  const doubleTapHintStyle = useMemo((): CSSProperties | null => {
    if (!showDoubleTapHint || containerW <= 0 || containerH <= 0) return null;

    const margin = 12;
    const hintH = 40;
    const hasSharp = shouldMapToSharp && sharpRect.width > 0 && sharpRect.height > 0;

    if (hasSharp) {
      const imageTop = sharpRect.y;
      const letterboxBand = imageTop - minHintTopPx;
      // 上レターボックス（画像外・左上の上）に収まらなければ非表示
      if (letterboxBand < hintH + 4) return null;

      const topPx = minHintTopPx + (letterboxBand - hintH) / 2;
      return {
        left: `${((sharpRect.x + margin) / containerW) * 100}%`,
        top: `${(topPx / containerH) * 100}%`,
        maxWidth: sharpRect.width - margin * 2,
      };
    }

    return {
      left: margin,
      top: minHintTopPx,
      maxWidth: 'min(240px, calc(100% - 24px))',
    };
  }, [
    showDoubleTapHint,
    shouldMapToSharp,
    sharpRect,
    containerW,
    containerH,
    minHintTopPx,
  ]);

  const scaledUp = displayScale > 1;
  /** スマホ縦: 16:9 スペース上 + 固定投稿ドック下 */
  const mobilePostSplit = useMobileBottomSheet && quickPostOpen;

  // ボトムシート表示中は背面の縦スクロールを止める（iOS でパネル外に抜けるのを防ぐ）
  useEffect(() => {
    if (!mobilePostSplit) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobilePostSplit]);
  /** スマホ横: 左スペース + 右固定投稿ドック */
  const mobilePostLandscapeSplit = isMobileLandscape && quickPostOpen;

  const quickPostPanel = (
    <PostScreen
      key={postScreenKey}
      panelMode={mobilePostSplit ? 'bottom' : 'side'}
      initialPosition={quickPostPos ?? undefined}
      initialMessage={speechPostInitialMessage}
      speechEditMode={!!speechEditOriginal}
      speechEditOriginal={speechEditOriginal}
      onSaveSpeechDraft={handleSaveSpeechDraft}
      onClose={handleQuickPostClose}
      speechToFreePosterRef={speechToFreePosterRef}
      onSendingChange={setPostSending}
      postTargetOverride={postTargetOverride}
    />
  );

  if (showActiveSpaceUnavailableBanner) {
    return (
      <SpaceShellUnavailableView
        onGoAccount={() => navigate('account')}
        onGoCommunity={
          selectedCommunityId
            ? () => navigate('community', selectedCommunityId)
            : undefined
        }
      />
    );
  }

  return (
    <div
      ref={attachSpaceRoot}
      className={`${styles.container} ${immersiveLayout ? styles.containerImmersive : ''} ${scaledUp ? styles.containerScaledScroll : ''} ${showPaneBar ? styles.containerWithPaneBar : ''} ${mobilePostLandscapeSplit ? styles.containerMobilePostLandscapeSplit : ''} ${mobilePostSplit ? styles.containerMobilePostSheetOpen : ''}`}
    >
      <ScaledContent
        className={`${styles.scaledCanvas} ${immersiveLayout ? styles.scaledCanvasImmersive : ''} ${mobilePostLandscapeSplit ? styles.scaledCanvasMobilePostLandscapeSplit : ''}`}
      >
      {isContentArchived && !isVisiting && <SpaceArchiveBanner />}
      {showWelcomeGuide && (
        <SpaceWelcomeGuide
          nickname={welcomeGuideNickname}
          description={welcomeGuideDescription}
          interactionHint={welcomeGuideInteractionHint}
          onClose={handleWelcomeGuideClose}
        />
      )}
      {/* スライドショーモード（書き出し対象外・全画面オーバーレイ） */}
      {viewMode === 'slideshow' && (
        <SlideshowView
          hossiis={filteredHossiis}
          onExit={() => setViewMode('full')}
        />
      )}

      {/* 書き出しキャプチャ範囲: 壁紙・星・バブル・粒子・キャラ・装飾のみ */}
      <div
        ref={spaceExportRootRef}
        className={`${styles.spaceExportRoot} ${backgroundClass}`}
        style={backgroundStyle}
      >
      {imageWallpaperUrl != null && (
        <div className={bgStyles.bgImageStack} aria-hidden>
          <div
            className={bgStyles.bgImageBlurFill}
            style={{ backgroundImage: `url(${imageWallpaperUrl})` }}
          />
          <div
            className={bgStyles.bgImageSharp}
            style={{ backgroundImage: `url(${imageWallpaperUrl})` }}
          />
        </div>
      )}
      {/* 星レイヤー（Hossii OFF時のみ表示） */}
      <StarLayer />

      {/* バブルエリア（背景クリックでデセレクト。仕様 63: クイック投稿/ログのダブル・トリプルもこの全面ヒット領域のみ） */}
      <div
        ref={mergeBubbleAreaRef}
        id="space-pane-panel"
        role="tabpanel"
        aria-labelledby={
          contextActivePaneId ? `space-pane-tab-${contextActivePaneId}` : undefined
        }
        className={`${styles.bubbleArea} ${backgroundPeekMode && isMobilePortrait ? styles.bubbleAreaBackgroundPeek : ''} ${modeTransitionPhase === 'out' ? styles.modeTransitionOut : ''} ${modeTransitionPhase === 'in' ? styles.modeTransitionIn : ''}`}
        data-bubble-area
        data-space-background
        onClick={handleContainerClick}
        onDoubleClick={handleDoubleClick}
        onPointerDown={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest('[data-hossii-bubble]')) {
            setSelectedBubbleId(null);
          }
        }}
      >
        <PinTray
          pinnedHossiis={pinnedHossiisForTray}
          onHighlight={handlePinHighlight}
          onUnpin={unpin}
        />
        {showByAuthorLoadingOverlay && (
          <div className={styles.byAuthorLoadingOverlay} data-space-export="exclude">
            <p className={styles.byAuthorLoadingText}>投稿者を整理しています…</p>
          </div>
        )}
        {filteredHossiis.length === 0 && activeTagFilter != null && (
          <div className={styles.tagFilterEmpty} data-space-export="exclude">
            <span className={styles.tagFilterEmptyIcon} aria-hidden>🏷</span>
            <p className={styles.tagFilterEmptyText}>
              「#{activeTagFilter}」の投稿はまだありません
            </p>
            <button
              type="button"
              className={styles.tagFilterEmptyButton}
              onClick={() => applyTagFilter(null)}
            >
              すべての投稿を表示する
            </button>
          </div>
        )}
        <ConnectionOverlay
          bubbleAreaRef={bubbleAreaRef}
          connections={devMockConnections}
          selectedBubbleId={selectedBubbleId}
          presentationMode={presentationMode}
          isMobile={isMobile}
          layoutMode={layoutMode}
          activePaneId={connectionActivePaneId}
          visibleHossiiIds={visibleHossiiIds}
        />
        {layoutMode === 'byAuthor'
          ? authorGroups.map((group, index) => {
              const pos = authorClusterPositions[index] ?? { x: 8, y: 22 };
              const clusterPos = isMobile ? mapDisplayPos(pos) : pos;

              return (
                <AuthorClusterBubble
                  key={group.groupKey}
                  group={group}
                  currentAuthorName={
                    postAuthorDisplayNames.get(group.latestPost.id) ??
                    postAuthorDisplayNames.get(group.posts[0]!.id)
                  }
                  position={clusterPos}
                  viewMode={viewMode}
                  expanded={expandedClusterKeys.has(group.groupKey)}
                  onToggleExpand={() => toggleClusterExpand(group.groupKey)}
                  onOpenTimeline={() => setSelectedAuthorGroup(group)}
                  canEdit={false}
                  orderedStackZ={index + 1}
                  isMobilePortrait={isMobilePortrait}
                />
              );
            })
          : filteredHossiis.map((hossii, index) => {
            const postAnimClass =
              tagFilterPhase === 'out'
                ? styles.postItemFilterOut
                : tagFilterPhase === 'in'
                  ? styles.postItemFilterIn
                  : '';
            const orderedGridIndex =
              layoutMode === 'ordered' && orderedSortDirection === 'asc'
                ? filteredHossiis.length - 1 - index
                : index;
            const pos = positionsByHossiiId[hossii.id] ?? { x: 50, y: 50 };

            const displayPos = mapDisplayPos(pos);

            const isThisSelected = selectedBubbleId === hossii.id;
            const isPinHighlighted = pinHighlightId === hossii.id;
            const animationLevel = resolveAnimationLevel(index, {
              promoteFull:
                selectedPostId === hossii.id ||
                hoveredHossiiId === hossii.id ||
                previewHossiiIds.has(hossii.id) ||
                activeBubbleId === hossii.id ||
                isThisSelected,
              promoteLight: recentHighlightIds.has(hossii.id) || isPinHighlighted,
            });
            const displayStackZ =
              layoutMode === 'ordered'
                ? orderedGridIndex + 1
                : displayStackZFromIndex(index);

            if (renderAsStar) {
              return (
                <div key={hossii.id} className={postAnimClass} style={{ display: 'contents' }}>
                  <StarView
                    hossii={hossii}
                    currentAuthorName={postAuthorDisplayNames.get(hossii.id)}
                    x={displayPos.x}
                    y={displayPos.y}
                    anchor={layoutMode === 'ordered' ? 'topLeft' : 'center'}
                    onClick={handleStarClick}
                    onMouseEnter={handleStarMouseEnterStable}
                    onMouseLeave={handleStarMouseLeave}
                    showPreview={
                      useStarView &&
                      !backgroundPeekMode &&
                      (previewHossiiIds.has(hossii.id) || pinnedIds.has(hossii.id))
                    }
                    isPcStarMode={showPcStarHover}
                    markerType={spaceSettings?.starMarkerType ?? DEFAULT_STAR_MARKER}
                    isPinned={isPinned(hossii.id)}
                    onPinToggle={handlePinToggle}
                    showPinUi={showPinUi}
                    isRecentHighlight={recentHighlightIds.has(hossii.id) || isPinHighlighted}
                    orderedStackZ={displayStackZ}
                    animationLevel={animationLevel}
                    displayIndex={index}
                    timelineDepthActive={timelineDepthActive}
                  />
                </div>
              );
            }

            return (
              <div key={hossii.id} className={postAnimClass} style={{ display: 'contents' }}>
              <Bubble
                hossii={hossii}
                currentAuthorName={postAuthorDisplayNames.get(hossii.id)}
                index={index}
                position={displayPos}
                orderedStackZ={displayStackZ}
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
                likesEnabled={likesEnabledForView}
                onLike={handleLike}
                bubbleShapePng={hossii.bubbleShapePng ?? spaceForVisual?.bubbleShapePng}
                layoutAlignTopLeft={layoutMode === 'ordered'}
                isRecentHighlight={recentHighlightIds.has(hossii.id) || isPinHighlighted}
                isPinned={isPinned(hossii.id)}
                onPinToggle={handlePinToggle}
                showPinUi={showPinUi}
                animationLevel={animationLevel}
                canManageOwn={canManageOwnHossii(hossii.id)}
                onOwnerDeleted={handleBubbleDeselect}
              />
              </div>
            );
          })}
        {showDoubleTapHint && doubleTapHintStyle && (
          <div
            className={styles.doubleTapHint}
            style={doubleTapHintStyle}
            role="status"
            data-space-export="exclude"
          >
            ダブルタップしたところに投稿できるよ
          </div>
        )}
        {backgroundPeekMode && isMobilePortrait && (
          <div className={styles.backgroundPeekHint} data-space-export="exclude" aria-live="polite">
            背景を表示中 — もう一度タップで戻る
          </div>
        )}
        {useStarView && hoveredHossiiId && hoverAnchorRect && !hasInlineStarPreview(hoveredHossiiId) && (() => {
          const hovered = filteredHossiis.find((h) => h.id === hoveredHossiiId);
          if (!hovered) return null;
          return (
            <StarHoverPreview
              hossii={hovered}
              anchorRect={hoverAnchorRect}
              isPinned={isPinned(hovered.id)}
              onPinToggle={handlePinToggle}
              showPinUi={showPinUi}
              onMouseEnter={handlePreviewMouseEnter}
              onMouseLeave={handlePreviewMouseLeave}
            />
          );
        })()}
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

      {/* マイHossiiレイヤー */}
      {controlState.hossiiVisible && activeSpace && !isVisiting && showMyHossiiLayer && (
        <MyHossiiLayer
          spaceId={contentSpace?.id ?? activeSpace.id}
          enabled={myHossiiEnabled}
          motionMode={myHossiiMotionMode}
          logVisibility={myHossiiLogVisibility}
          hossiis={filteredHossiis}
          activityHossiis={allSpaceHossiisForMyHossii}
          visiblePostCount={filteredHossiis.length}
          currentUserId={currentUser?.uid ?? null}
          isAuthenticatedViewer={!!currentUser}
          hasMyHossiiRegistered={hasMyHossiiRegistered}
          participantEligibility={myHossiiParticipantEligibility}
          prefersReducedMotion={prefersReducedMotion}
          onViewAuthorLogs={(group) => setSelectedAuthorGroup(group)}
        />
      )}

      {/* Hossiiキャラ（Hossii表示時のみ） */}
      {controlState.hossiiVisible && (
        <HossiiLive
          lastTriggerId={reactionTrigger?.id}
          emotion={reactionTrigger?.emotion}
          onParticle={handleParticle}
          isListening={isRecognizing}
          brainMessage={brainMessage?.text ?? null}
          hossiis={filteredHossiis}
          readingEnabled={voiceEnabled}
          onLikeTrigger={likeReactionTrigger?.id}
          idleImageOverride={spaceCharacterImageUrl ?? null}
          guideMessage={guideMessage}
          onGuideDismiss={dismissGuide}
        />
      )}

      {/* A02: スペース装飾オーバーレイ */}
      {(spaceForVisual?.decorations ?? []).map((decoration: SpaceDecoration) => {
        if (decoration.isVisible === false) return null;
        const isOpen = selectedDecorationId === decoration.id;

        if (decoration.type === 'image' && decoration.imageUrl) {
          return (
            <div
              key={decoration.id}
              className={styles.decorationWidget}
              style={{ left: `${decoration.position.x}%`, top: `${decoration.position.y}%` }}
            >
              <img
                src={decoration.imageUrl}
                alt={decoration.content.title ?? '装飾画像'}
                className={styles.decorationImage}
              />
            </div>
          );
        }

        const icon = decoration.type === 'sign' ? '🪧' : '📋';

        return (
          <div
            key={decoration.id}
            className={styles.decorationWidget}
            style={{ left: `${decoration.position.x}%`, top: `${decoration.position.y}%` }}
            onClick={() => setSelectedDecorationId(isOpen ? null : decoration.id)}
          >
            <span className={styles.decorationIcon}>{icon}</span>
            {decoration.content.title && (
              <span className={styles.decorationTitle}>{decoration.content.title}</span>
            )}
            {decoration.type === 'sign' && !isOpen && (
              <span className={styles.decorationTitle}>{decoration.content.body.slice(0, 24)}</span>
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
                {decoration.linkUrl && (
                  <a
                    href={decoration.linkUrl}
                    className={styles.decorationPopupLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    リンクを開く
                  </a>
                )}
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
      </div>

      {/* 訪問モードバナー（書き出し対象外） */}
      {isVisiting && visitingSpaceInfo && (
        <VisitBanner
          spaceName={visitingSpaceInfo.name}
          spaceURL={visitingSpaceInfo.spaceURL}
          onBack={() => setVisitingSpace(null)}
        />
      )}

      {/* 初回ロードで表示可能な投稿がまだないときだけ全面スピナー */}
      {showInitialLoadingOverlay && (
        <div
          data-space-export="exclude"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.18)',
            backdropFilter: 'blur(2px)',
          }}
        >
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

      {/* スペースタイトル pill バッジ（モバイル専用・書き出し対象外） */}
      <div ref={spaceTitleRowRef} className={styles.spaceTitleRow} data-space-export="exclude">
        <div className={styles.spaceTitle}>
          <span className={styles.spaceTitleDot} />
          <span className={styles.spaceTitleText}>{spaceForVisual?.name ?? 'My Space'}</span>
        </div>
        {hasDescription && isMobile && (
          <SpaceDescriptionInline
            description={spaceDescription}
            className={styles.spaceTitleDescription}
          />
        )}
      </div>

      {showPaneBar && (
        <SpacePaneBar
          rootRef={mobilePaneBarRef}
          spaceId={activeSpaceId ?? ''}
          variant="mobile"
          folders={effectiveFolders}
          visiblePanes={visiblePanes}
          activePaneId={paneBarActivePaneId}
          isAdmin={isAdmin}
          disabled={postSending || paneReorderBusy}
          onSelect={handlePaneSelect}
          onAddPane={isAdmin && !isContentArchived ? () => setPaneCreateOpen(true) : undefined}
          onAddFolder={isAdmin && !isContentArchived ? handleAddFolder : undefined}
          onRenameFolder={isAdmin && !isContentArchived ? handleRenameFolder : undefined}
          onDeleteFolder={isAdmin && !isContentArchived ? handleDeleteFolder : undefined}
          onReorder={isAdmin && !isContentArchived ? handlePaneReorder : undefined}
          onMoveToFolder={isAdmin && !isContentArchived ? handleMoveToFolder : undefined}
          onReorderFolder={isAdmin && !isContentArchived ? handleReorderFolder : undefined}
          personalShortcut={personalShortcut}
        />
      )}
      {/* 右上: 書き出し / 投稿数バッジ / 投稿順ツールバー / タグ・星 */}
      {(showPostCountBadge ||
        (layoutMode === 'ordered' && viewMode !== 'slideshow') ||
        (layoutMode === 'byAuthor' && viewMode !== 'slideshow') ||
        showSpaceExportButton ||
        showStarToggle ||
        showTagControls ||
        (isMobile && activeTagFilter)) && (
        <div className={styles.spaceTopRightCluster}>
          {showSpaceExportButton && (
            <button
              type="button"
              className={styles.spaceExportButton}
              title={spaceExportButtonTitle}
              disabled={
                spaceExportBusy ||
                spaceExportBlockedUI ||
                filteredHossiis.length > SPACE_EXPORT_MAX_BUBBLES
              }
              onClick={() => setSpaceExportModalOpen(true)}
            >
              <ImageDown size={14} />
              書き出し
            </button>
          )}
          {showPostCountBadge && (
            <div
              className={styles.postCountBadge}
              aria-live="polite"
              title="現在の期間・件数・表示モードで画面に出ている投稿数"
            >
              <Hash size={11} />
              <span className={styles.postCountBadgeValue}>{filteredHossiis.length}</span>
              <span className={styles.postCountBadgeUnit}>件</span>
            </div>
          )}
          {showFetchLoadingBadge && (
            <div className={styles.fetchLoadingBadge} aria-live="polite">
              読み込み中… ({fetchProgress.loadedCount}件)
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
          {layoutMode === 'byAuthor' && viewMode !== 'slideshow' && (
            <div className={styles.orderedSortToolbar} role="group" aria-label="投稿者まとめの並び">
              <button
                type="button"
                className={`${styles.orderedSortButton} ${authorGroupSort === 'firstPostAsc' ? styles.orderedSortButtonActive : ''}`}
                title="初投稿が早い順（左から）"
                aria-pressed={authorGroupSort === 'firstPostAsc'}
                onClick={() => setAuthorGroupSort('firstPostAsc')}
              >
                初投稿順
              </button>
              <button
                type="button"
                className={`${styles.orderedSortButton} ${authorGroupSort === 'latestDesc' ? styles.orderedSortButtonActive : ''}`}
                title="最新投稿が新しい順（左から）"
                aria-pressed={authorGroupSort === 'latestDesc'}
                onClick={() => setAuthorGroupSort('latestDesc')}
              >
                最新順
              </button>
              <button
                type="button"
                className={`${styles.orderedSortButton} ${authorGroupSort === 'postCountDesc' ? styles.orderedSortButtonActive : ''}`}
                title="投稿数が多い順（左から）"
                aria-pressed={authorGroupSort === 'postCountDesc'}
                onClick={() => setAuthorGroupSort('postCountDesc')}
              >
                投稿数順
              </button>
            </div>
          )}
          {(showTagControls || showStarToggle || (isMobile && activeTagFilter)) && viewMode !== 'slideshow' && (
            <div className={styles.topRightRow}>
              {!isMobile && showTagControls && (
                <>
                  <button
                    ref={tagFilterButtonRef}
                    type="button"
                    className={`${styles.clusterPill} ${activeTagFilter ? styles.clusterPillActive : ''}`}
                    aria-haspopup="listbox"
                    aria-expanded={tagPanelOpen}
                    aria-label="タグで絞り込む"
                    disabled={tagCandidates.length === 0 && !activeTagFilter}
                    onClick={() => setTagPanelOpen((o) => !o)}
                  >
                    {activeTagFilter ? (
                      <>
                        <span>🏷</span>
                        <span className={styles.clusterPillLabel}>#{activeTagFilter}</span>
                        <span
                          className={styles.clusterPillClear}
                          role="button"
                          tabIndex={0}
                          aria-label="タグフィルタを解除"
                          onClick={(e) => {
                            e.stopPropagation();
                            applyTagFilter(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              applyTagFilter(null);
                            }
                          }}
                        >
                          ×
                        </span>
                      </>
                    ) : (
                      <>
                        <span>🏷</span>
                        <span>タグ</span>
                        <span className={styles.chevron} aria-hidden>▾</span>
                      </>
                    )}
                  </button>
                  <TagFilterPopover
                    key={tagPanelOpen ? `open-${activeTagFilter ?? 'all'}` : 'closed'}
                    open={tagPanelOpen}
                    anchorRef={tagFilterButtonRef}
                    activeTag={activeTagFilter}
                    candidates={tagCandidates}
                    tagCounts={tagCounts}
                    onSelect={applyTagFilter}
                    onClose={() => setTagPanelOpen(false)}
                  />
                </>
              )}
              {isMobile && activeTagFilter && (
                <span className={`${styles.clusterPill} ${styles.clusterPillActive}`}>
                  #{activeTagFilter}
                </span>
              )}
              {showStarToggle && (
                <button
                  type="button"
                  className={`${styles.clusterPill} ${presentationMode === 'stars' ? styles.clusterPillActive : ''}`}
                  aria-pressed={presentationMode === 'stars'}
                  aria-label={
                    presentationMode === 'stars'
                      ? 'カスタムモードに切り替え'
                      : '星モードに切り替え'
                  }
                  title={
                    presentationMode === 'stars'
                      ? 'カスタムモード（吹き出し表示）に切り替え'
                      : '星モードに切り替え'
                  }
                  onClick={handleStarToggle}
                >
                  {presentationMode === 'stars' ? 'カスタム' : '☆ 星'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Listening インジケーター（タップで音声パネル開閉・書き出し対象外） */}
      {listenMode && (
        <div
          className={styles.listeningIndicator}
          data-space-export="exclude"
          onClick={() => setSpeechPanelOpen(prev => !prev)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSpeechPanelOpen(prev => !prev); }}
        >
          <span className={styles.listeningIcon}>🎙</span>
          <span className={styles.listeningText}>Listening</span>
        </div>
      )}

      {/* F14: 選択時ツールバー（書き出し対象外） */}
      {selectedBubbleId && !isContentArchived && (
        <div className={styles.editToolbar} data-space-export="exclude">
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

      {/* 漂着メッセージボトル（書き出し対象外） */}
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

      {/* 音声パネル（スペースルートへ portal — zoom 対象の ScaledContent の外かつ Fullscreen API 内） */}
      {speechPanelOpen &&
        createPortal(
          <SpeechPanel
            {...speechPanelFloating}
            listenMode={listenMode}
            onListenToggle={handleSpeechPanelListenToggle}
            confirmedText={panelConfirmedText}
            interimText={interimText}
            speechLevels={speechLevels}
            setSpeechLevels={setSpeechLevels}
            onPost={(text) => postHossii({ message: text, logType: 'speech', origin: 'manual' })}
            onEditCandidate={openSpeechCandidateEditor}
            onDismissCandidate={dismissSpeechCandidate}
            dismissedCandidates={dismissedSpeechCandidates}
            onSendCandidateToFreePost={
              quickPostOpen
                ? (text) => speechToFreePosterRef.current?.(text)
                : undefined
            }
            onClose={() => {
              setSpeechPanelOpen(false);
              setPanelConfirmedText('');
              setDismissedSpeechCandidates([]);
            }}
          />,
          speechPanelPortalEl ?? document.body
        )}

      {/* モバイル: 詳細モーダル */}
      {selectedPost && (
        <PostDetailModal
          hossii={selectedPost}
          onClose={() => setSelectedPostId(null)}
          likesEnabled={likesEnabledForView}
          onLike={isContentArchived ? undefined : handleLike}
          readOnlyArchived={isContentArchived}
        />
      )}

      {selectedAuthorGroup && (
        <AuthorTimelineModal
          group={selectedAuthorGroup}
          currentAuthorName={
            postAuthorDisplayNames.get(selectedAuthorGroup.latestPost.id) ??
            postAuthorDisplayNames.get(selectedAuthorGroup.posts[0]!.id)
          }
          onClose={() => setSelectedAuthorGroup(null)}
          onSelectPost={(id) => setSelectedPostId(id)}
          likesEnabled={likesEnabledForView}
          onLike={isContentArchived ? undefined : handleLike}
          isMobilePortrait={isMobilePortrait}
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

      {showVoiceConsent && (
        <VoiceConsentModal
          onConsent={() => {
            setVoiceConsent(true);
            setVoiceEnabled(true);
            setShowVoiceConsent(false);
          }}
          onCancel={() => setShowVoiceConsent(false)}
        />
      )}

      {/* PC版のみ表示: トップバー、右上メニュー、左コントロールバー、QR */}
      {viewMode !== 'slideshow' && (
        <>
          <TopBar
            description={
              hasDescription && descriptionPanelVisible && !isMobile
                ? spaceDescription
                : undefined
            }
          />
          {showPaneBar && (
            <SpacePaneBar
              spaceId={activeSpaceId ?? ''}
              variant="desktop"
              folders={effectiveFolders}
              visiblePanes={visiblePanes}
              activePaneId={paneBarActivePaneId}
              isAdmin={isAdmin}
              disabled={postSending || paneReorderBusy}
              onSelect={handlePaneSelect}
              onAddPane={isAdmin && !isContentArchived ? () => setPaneCreateOpen(true) : undefined}
              onAddFolder={isAdmin && !isContentArchived ? handleAddFolder : undefined}
              onRenameFolder={isAdmin && !isContentArchived ? handleRenameFolder : undefined}
              onDeleteFolder={isAdmin && !isContentArchived ? handleDeleteFolder : undefined}
              onReorder={isAdmin && !isContentArchived ? handlePaneReorder : undefined}
              onMoveToFolder={isAdmin && !isContentArchived ? handleMoveToFolder : undefined}
              onReorderFolder={isAdmin && !isContentArchived ? handleReorderFolder : undefined}
              personalShortcut={personalShortcut}
            />
          )}
          <TopRightMenu onPostClick={handleTopRightPostClick} postNavDisabled={isContentArchived} />
          <LeftControlBar
            controls={controlState}
            onToggle={handleControlToggle}
            onFullscreenToggle={handleFullscreenToggle}
            isMobile={isMobile}
            mobilePaneBarVisible={showPaneBar && isMobile}
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
            onWarp={handleIslandClick}
            isVisiting={isVisiting}
            qrPanelVisible={qrPanelVisible}
            onQrToggle={
              isMobile ? undefined : () => setQrPanelVisible((v) => !v)
            }
            descriptionPanelVisible={descriptionPanelVisible}
            onDescriptionToggle={
              hasDescription && !isMobile
                ? () => setDescriptionPanelVisible((v) => !v)
                : undefined
            }
            showPostCountBadge={showPostCountBadge}
            onShowPostCountBadgeToggle={
              isMobile ? undefined : handleShowPostCountBadgeToggle
            }
            tagFilterCandidates={isMobile ? tagCandidates : undefined}
            activeTagFilter={isMobile ? activeTagFilter : undefined}
            onTagFilterChange={isMobile ? applyTagFilter : undefined}
            onOpenWelcomeGuide={welcomeGuideAllowed ? handleOpenWelcomeGuide : undefined}
          />
        </>
      )}

      {/* クイック投稿パネル（スマホ縦=固定ボトムシート、横=右固定ドック、PC のみ FloatingPanelShell） */}
      {quickPostOpen && !isContentArchived &&
        (mobilePostSplit ? (
          <div className={styles.mobilePostSheet}>{quickPostPanel}</div>
        ) : mobilePostLandscapeSplit ? (
          <div className={`${styles.mobilePostSideDock} ${styles.quickPostSideChrome}`}>
            {quickPostPanel}
          </div>
        ) : (
          <FloatingPanelShell
            storageKey="quickPost.desktop"
            defaultRect={quickPostDefaultRect}
            minW={280}
            minH={320}
            zIndex={310}
            className={styles.quickPostSideChrome}
          >
            {quickPostPanel}
          </FloatingPanelShell>
        ))}

      {quickLogOpen && (
        <FloatingPanelShell
          storageKey={
            useMobileBottomSheet
              ? 'logList.mobile'
              : isMobile
                ? 'logList.mobileLandscape'
                : 'logList.desktop'
          }
          defaultRect={quickLogDefaultRect}
          minW={isMobile ? 200 : 280}
          minH={isMobile ? 240 : 320}
          zIndex={320}
          className={
            useMobileBottomSheet ? styles.quickLogBottomChrome : styles.quickLogSideChrome
          }
        >
          <LogListBody
            hossiis={logListHossiis}
            spaceId={logListSpaceId}
            presetTags={logPresetTags}
            panelMode
            onClose={handleQuickLogClose}
            onAfterAdminHide={isVisiting ? removeVisitingHossii : undefined}
            onOpenQuickPost={
              isContentArchived
                ? undefined
                : () => {
                    handleQuickLogClose();
                    openQuickPost();
                  }
            }
            readOnlyArchived={isContentArchived}
            onLikeCountUpdated={isVisiting ? patchVisitingHossiiLikeCount : undefined}
          />
        </FloatingPanelShell>
      )}
      {viewMode !== 'slideshow' && qrPanelVisible && !isMobileLandscape && <QRCodePanel />}

      {/* 書き出し前置き設定モーダル */}
      {spaceExportModalOpen && !spaceExportBusy && (
        <div
          className={styles.spaceExportModalBackdrop}
          onClick={(e) => { if (e.target === e.currentTarget) setSpaceExportModalOpen(false); }}
        >
          <div
            className={styles.spaceExportModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="space-export-pre-title"
          >
            <p id="space-export-pre-title" className={styles.spaceExportModalTitle}>
              📸 書き出し
            </p>
            <p className={styles.spaceExportModalHint}>
              スペースを PNG 画像として保存します。
            </p>
            <div className={styles.spaceExportFormatRow}>
              <div className={`${styles.spaceExportFormatCard} ${styles.spaceExportFormatCardActive}`}>
                <span className={styles.spaceExportFormatCardIcon}>🖼</span>
                <span className={styles.spaceExportFormatCardLabel}>PNG</span>
              </div>
              <div className={`${styles.spaceExportFormatCard} ${styles.spaceExportFormatCardDisabled}`}>
                <span className={styles.spaceExportFormatCardIcon}>📷</span>
                <span className={styles.spaceExportFormatCardLabel}>JPEG</span>
                <span className={styles.spaceExportFormatCardSoon}>準備中</span>
              </div>
              <div className={`${styles.spaceExportFormatCard} ${styles.spaceExportFormatCardDisabled}`}>
                <span className={styles.spaceExportFormatCardIcon}>📄</span>
                <span className={styles.spaceExportFormatCardLabel}>PDF</span>
                <span className={styles.spaceExportFormatCardSoon}>準備中</span>
              </div>
            </div>
            <div className={styles.spaceExportActions}>
              <button
                type="button"
                className={styles.spaceExportConfirmButton}
                onClick={() => { setSpaceExportModalOpen(false); void handleSpaceExport(); }}
              >
                <ImageDown size={14} />
                書き出す
              </button>
              <button
                type="button"
                className={styles.spaceExportModalCancel}
                onClick={() => setSpaceExportModalOpen(false)}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 書き出し進行モーダル */}
      {spaceExportBusy && (
        <div className={styles.spaceExportModalBackdrop}>
          <div
            className={styles.spaceExportModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="space-export-modal-title"
          >
            <p id="space-export-modal-title" className={styles.spaceExportModalTitle}>
              書き出し中…
            </p>
            <p className={styles.spaceExportModalHint}>
              しばらくお待ちください。投稿や背景によっては時間がかかることがあります。
            </p>
            <button
              type="button"
              className={styles.spaceExportModalCancel}
              onClick={handleSpaceExportCancel}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 訪問中に投稿しようとしたときのフィードバック */}
      {isContentArchived && !isVisiting && <SpaceArchivePostNotice />}

      <HossiiToast
        show={visitingToastVisible}
        message="訪問中のスペースには投稿できません"
        type="info"
        duration={2000}
        onClose={() => setVisitingToastVisible(false)}
      />

      <HossiiToast
        show={paneToastVisible}
        message={paneToastMessage}
        type={paneToastType}
        duration={2200}
        onClose={() => setPaneToastVisible(false)}
      />

      {activeSpaceId && (
        <SpacePaneCreateDialog
          open={paneCreateOpen}
          spaceId={activeSpaceId}
          existingPanes={panes}
          onClose={() => setPaneCreateOpen(false)}
          onCreated={(pane) => void handlePaneCreated(pane)}
          onError={(message) => showPaneToast(message, 'error')}
        />
      )}
    </div>
  );
});
