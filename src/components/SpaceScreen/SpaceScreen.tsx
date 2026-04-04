import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useDisplayPrefs } from '../../core/contexts/DisplayPrefsContext';
import { useAudioListener, type AudioEvent } from '../../core/hooks/useAudioListener';
import { useSpeechRecognition, type SpeechEvent } from '../../core/hooks/useSpeechRecognition';
import { useReactionBroadcast, type ReactionEvent } from '../../core/hooks/useReactionBroadcast';
import { useMediaQuery } from '../../core/hooks/useMediaQuery';
import { useHossiiBrain } from '../../core/hooks/useHossiiBrain';
import { useAuth } from '../../core/contexts/useAuth';
import { useSpaceSettings } from './useSpaceSettings';
import { useNeighborSpace } from './useNeighborSpace';
import type { EmotionKey } from '../../core/types';
import type { SpaceDecoration } from '../../core/types/space';
import { EMOJI_BY_EMOTION } from '../../core/assets/emotions';
import { createBubblePosition } from '../../core/utils/bubblePosition';
import { incrementLike } from '../../core/utils/likesApi';
import { getPeriodCutoff } from '../../core/utils/displayPrefsStorage';
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
import { recordBottleDelivery } from '../../core/utils/neighborsApi';
import styles from './SpaceScreen.module.css';
import bgStyles from '../../styles/spaceBackgrounds.module.css';

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

export const SpaceScreen = () => {
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
      showHossii, listenMode, hasConsentedToListen, emotionLogEnabled, speechLogEnabled,
      speechLevels, displayScale, displayPeriod, displayLimit, viewMode,
    },
    setShowHossii,
    setListenMode,
    setListenConsent,
    setDisplayScale,
    setDisplayPeriod,
    setDisplayLimit,
    setViewMode,
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
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
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
  } = useNeighborSpace({
    activeSpaceId,
    visitingSpaceId,
    isVisiting,
    spaceSettings,
    setVisitingSpace,
  });

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

  // DisplayScale を循環させる（100% → 125% → 150% → 100%...）
  const handleDisplayScaleCycle = useCallback(() => {
    const scales = [1, 1.25, 1.5] as const;
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

  // Listen モードで検出された音声イベントを処理（感情ログ/笑いログ）
  const handleAudioEvent = useCallback((event: AudioEvent) => {
    // 感情ログが無効なら無視
    if (!emotionLogEnabled) return;

    // 笑いログは別扱い（メッセージなし）
    const isLaughter = event.type === 'laugh';

    // Hossii として自動投稿
    addHossii({
      message: isLaughter ? '' : event.message, // 笑いは空
      emotion: event.emotion,
      authorNameOverride: 'Hossii',
      logType: 'emotion',
      origin: 'auto',
      autoType: isLaughter ? 'laughter' : 'emotion',
      language: event.language,
    });
  }, [addHossii, emotionLogEnabled]);

  // 音声認識イベントを処理（ことばログ）
  const handleSpeechEvent = useCallback((event: SpeechEvent) => {
    addHossii({
      message: event.text,
      authorNameOverride: 'Hossii',
      logType: 'speech',
      speechLevel: event.level,
      origin: 'auto',
      autoType: 'speech',
      language: event.language,
    });
  }, [addHossii]);

  // 音声リスナー（感情ログ用）
  const { isListening } = useAudioListener({
    enabled: listenMode && emotionLogEnabled,
    onAudioEvent: handleAudioEvent,
  });

  // 音声認識（ことばログ用）
  useSpeechRecognition({
    enabled: listenMode && speechLogEnabled,
    speechLevels,
    onSpeechEvent: handleSpeechEvent,
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
      if (h.isHidden) return false;
      if (cutoff && h.createdAt < cutoff) return false;
      if (viewMode === 'image' && !h.imageUrl) return false;
      return true;
    });
    const sorted = [...visible].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return sorted.slice(0, limit);
  }, [hossiis, displayPeriod, displayLimit, viewMode]);

  // 各バブルの位置を事前計算（メモ化）
  const bubblePositions = useMemo(() => {
    return displayHossiis.map((_, index) => createBubblePosition(index));
  }, [displayHossiis]);

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

  // 背景スタイルを生成
  const { backgroundClass, backgroundStyle } = useMemo(() => {
    const bg = activeSpace?.background;
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
  }, [activeSpace]);

  // モバイルモーダル用の選択された投稿
  const selectedPost = selectedPostId
    ? displayHossiis.find(h => h.id === selectedPostId)
    : null;

  return (
    <div className={`${styles.container} ${backgroundClass}`} style={backgroundStyle}>
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
        🌳 {activeSpace?.name ?? 'My Space'}
      </div>

      {/* 共有ボタン（右上） */}
      <button
        type="button"
        className={styles.shareButtonSmall}
        aria-label="リンクをコピー"
        onClick={() => {
          const url = `${window.location.origin}${window.location.pathname}?space=${activeSpaceId}`;
          navigator.clipboard.writeText(url);
          alert('スペースのリンクをコピーしました');
        }}
      >
        🔗
      </button>

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
            // F02: 固定座標があればそれを優先、なければ index シード計算にフォールバック
            const pos = hossii.isPositionFixed && hossii.positionX != null && hossii.positionY != null
              ? { x: hossii.positionX, y: hossii.positionY }
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
                  onClick={() => setSelectedPostId(hossii.id)}
                  showPreview={previewHossiiIds.has(hossii.id)}
                />
              );
            }

            return (
              <Bubble
                key={hossii.id}
                hossii={hossii}
                index={index}
                position={pos}
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
                bubbleShapePng={hossii.bubbleShapePng ?? activeSpace?.bubbleShapePng}
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
          isListening={isListening}
          hossiiColor={spaceSettings?.hossiiColor}
          brainMessage={brainMessage?.text ?? null}
          hossiis={displayHossiis}
          readingEnabled={controlState.voiceEnabled}
          onLikeTrigger={likeReactionTrigger?.id}
        />
      )}

      {/* Listening インジケーター */}
      {listenMode && (
        <div className={styles.listeningIndicator}>
          <span className={styles.listeningIcon}>🎙</span>
          <span className={styles.listeningText}>Listening</span>
        </div>
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
      {(activeSpace?.decorations ?? []).map((decoration: SpaceDecoration) => {
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

      {/* PC版のみ表示: トップバー、右上メニュー、左コントロールバー、QRコードパネル（スライドショー中は非表示） */}
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
            neighbors={neighbors}
            onWarp={handleWarp}
            isVisiting={isVisiting}
          />
          <QRCodePanel />
        </>
      )}
    </div>
  );
};
