import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useAudioListener, type AudioEvent } from '../../core/hooks/useAudioListener';
import { useSpeechRecognition, type SpeechEvent } from '../../core/hooks/useSpeechRecognition';
import { useReactionBroadcast, type ReactionEvent } from '../../core/hooks/useReactionBroadcast';
import { useMediaQuery } from '../../core/hooks/useMediaQuery';
import { useHossiiBrain } from '../../core/hooks/useHossiiBrain';
import type { EmotionKey, Hossii } from '../../core/types';
import type { SpaceSettings } from '../../core/types/settings';
import { EMOJI_BY_EMOTION } from '../../core/assets/emotions';
import { loadFilters, saveFilters, type HossiiFilters } from '../../core/utils/filterStorage';
import { loadSpaceSettings } from '../../core/utils/settingsStorage';
import { Bubble } from './Tree';
import { StarView } from './StarView';
import { PostDetailModal } from '../PostDetailModal/PostDetailModal';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import { TopBar } from '../Navigation/TopBar';
import { LeftControlBar, type ControlState } from '../Navigation/LeftControlBar';
import { QRCodePanel } from '../Navigation/QRCodePanel';
import { HossiiLive } from '../Hossii/HossiiLive';
import { HossiiToggle } from '../HossiiToggle/HossiiToggle';
import { StarLayer } from '../StarLayer/StarLayer';
import { FilterBar } from '../FilterBar/FilterBar';
import styles from './SpaceScreen.module.css';
import bgStyles from '../../styles/spaceBackgrounds.module.css';

/** フィルタ適用関数 */
function applyFilters(hossiis: Hossii[], filters: HossiiFilters): Hossii[] {
  return hossiis.filter((h) => {
    // origin が未設定または 'manual' なら手動投稿扱い
    const isManual = !h.origin || h.origin === 'manual';
    const isAuto = h.origin === 'auto';

    if (isManual) {
      return filters.manual;
    }

    if (isAuto) {
      switch (h.autoType) {
        case 'emotion':
          return filters.autoEmotion;
        case 'speech':
          return filters.autoSpeech;
        case 'laughter':
          return filters.autoLaughter;
        default:
          // autoType未設定のautoは感情扱い
          return filters.autoEmotion;
      }
    }

    return true;
  });
}

/** カケラ粒子の型 */
type Particle = {
  id: string;
  emoji: string;
  x: number;
  y: number;
};

// パフォーマンス対策：表示件数制限
const MAX_DISPLAY_COUNT = 40;

// バブル位置生成（中央寄りに散らばる、画面端は避ける）
function createBubblePosition(index: number): { x: number; y: number } {
  // シード値としてindexを使い、deterministic なランダム風配置
  const seed = (index * 7919 + 1) % 1000;
  const seed2 = (index * 6271 + 3) % 1000;

  // 中央寄りにする（2つの乱数の平均 → 自然な中央寄せ）
  const r1 = seed / 1000;
  const r2 = seed2 / 1000;

  // 画面の 8% 〜 92% の範囲に配置（端を避ける）
  const x = 8 + ((r1 + r2) / 2) * 84;
  // 縦は 12% 〜 78% の範囲（上下ナビを避ける）
  const y = 12 + ((r2 + (1 - r1)) / 2) * 66;

  return { x, y };
}

/** リアクショントリガーの型 */
type ReactionTrigger = {
  id: string;
  emotion?: EmotionKey;
};

export const SpaceScreen = () => {
  const { state, getActiveSpaceHossiis, getActiveSpace, addHossii, setDisplayScale } = useHossiiStore();
  const { showHossii, listenMode, emotionLogEnabled, speechLogEnabled, speechLevels, activeSpaceId, displayScale } = state;
  const activeSpace = getActiveSpace();
  const [activeBubbleId, setActiveBubbleId] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  // 他タブからのリアクションを受け取るための状態
  const [broadcastedReaction, setBroadcastedReaction] = useState<ReactionTrigger | null>(null);
  // 前回の latestHossii.id を追跡（新規投稿検出用）
  const prevLatestIdRef = useRef<string | null>(null);
  // フィルタ状態
  const [filters, setFilters] = useState<HossiiFilters>(() => loadFilters(activeSpaceId));
  // モバイル判定とモーダル用の状態
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // スペース設定の読み込み
  const [spaceSettings, setSpaceSettings] = useState<SpaceSettings | null>(null);

  // 設定を読み込む関数
  const loadSettings = useCallback(() => {
    if (activeSpace) {
      const settings = loadSpaceSettings(activeSpace.id, activeSpace.name);
      setSpaceSettings(settings);
    }
  }, [activeSpace]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // フォーカス時に設定を再読み込み（設定画面から戻ってきたときなど）
  useEffect(() => {
    const handleFocus = () => {
      loadSettings();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadSettings]);

  // PC版コントロールバーの状態管理
  const [controlState, setControlState] = useState<ControlState>({
    isFullscreen: false,
    hossiiVisible: showHossii,
    micEnabled: listenMode,
    voiceEnabled: true,
  });

  // showHossii が変わったら controlState を同期
  useEffect(() => {
    setControlState((prev) => ({ ...prev, hossiiVisible: showHossii }));
  }, [showHossii]);

  const handleControlToggle = useCallback((key: keyof ControlState) => {
    setControlState((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

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

  // フィルタ変更時に保存
  const handleFilterChange = useCallback((newFilters: HossiiFilters) => {
    setFilters(newFilters);
    saveFilters(activeSpaceId, newFilters);
  }, [activeSpaceId]);

  // スペースが変わったらフィルタをリロード
  useEffect(() => {
    setFilters(loadFilters(activeSpaceId));
  }, [activeSpaceId]);

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

  // アクティブなスペースのログのみ取得
  const hossiis = getActiveSpaceHossiis();

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

  // 新しい順にソートしてフィルタ適用、上限まで表示
  const displayHossiis = useMemo(() => {
    const sorted = [...hossiis].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const filtered = applyFilters(sorted, filters);
    return filtered.slice(0, MAX_DISPLAY_COUNT);
  }, [hossiis, filters]);

  // 各バブルの位置を事前計算（メモ化）
  const bubblePositions = useMemo(() => {
    return displayHossiis.map((_, index) => createBubblePosition(index));
  }, [displayHossiis]);

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
      {/* 星レイヤー（Hossii OFF時のみ表示） */}
      <StarLayer />

      {/* スペースタイトル（情報レイヤー） */}
      <div className={styles.spaceTitle}>
        🌳 {activeSpace?.name ?? 'My Space'}
      </div>

      {/* 操作パネル（操作レイヤー） */}
      <div className={styles.controlPanel}>
        {/* 共有ボタン */}
        <button
          type="button"
          className={styles.shareButton}
          onClick={() => {
            const url = `${window.location.origin}${window.location.pathname}?space=${activeSpaceId}`;
            navigator.clipboard.writeText(url);
            alert('スペースのリンクをコピーしました');
          }}
        >
          🔗 共有
        </button>

        {/* Hossii & Listen トグル */}
        <HossiiToggle />
      </div>

      {/* ヘッダー（フィルター、スペース名、メニュー） */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <FilterBar filters={filters} onFilterChange={handleFilterChange} />
        </div>

        <div className={styles.headerCenter}>
          <h1 className={styles.spaceName}>
            <span className={styles.sparkle}>✨</span>
            {activeSpace?.name ?? 'My Space'}
            <span className={styles.sparkle}>✨</span>
          </h1>
        </div>

        <div className={styles.headerRight}>
          <TopRightMenu />
        </div>
      </header>

      {/* バブルエリア */}
      <div className={styles.bubbleArea}>
        {displayHossiis.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🌸</span>
            <p className={styles.emptyText}>まだ気持ちがありません</p>
          </div>
        ) : (
          displayHossiis.map((hossii, index) => {
            const pos = bubblePositions[index];

            // モバイル: スターを表示
            if (isMobile) {
              return (
                <StarView
                  key={hossii.id}
                  hossii={hossii}
                  x={pos.x}
                  y={pos.y}
                  onClick={() => setSelectedPostId(hossii.id)}
                />
              );
            }

            // デスクトップ: バブルを表示
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
        />
      )}

      {/* PC版のみ表示: トップバー、左コントロールバー、QRコードパネル */}
      <TopBar />
      <LeftControlBar
        controls={controlState}
        onToggle={handleControlToggle}
        onFullscreenToggle={handleFullscreenToggle}
        displayScale={displayScale}
        onDisplayScaleCycle={handleDisplayScaleCycle}
      />
      <QRCodePanel />
    </div>
  );
};
