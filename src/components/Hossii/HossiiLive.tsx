/**
 * HossiiLive - スペースを泳ぐ生き物
 *
 * 3レイヤー構成:
 * A. BaseMotion  - viewport全体をランダム移動
 * B. ReactionMotion - 投稿時の表情変化 + にこっ
 * C. TapMotion - タップ時の逃げ/寄り反応
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { EmotionKey, Hossii } from '../../core/types';
import type { HossiiColor } from '../../core/types/settings';
import { getRandomBubble8, EMOJI_BY_EMOTION } from '../../core/assets/emotions';
import { getHossiiFace } from '../../core/assets/hossiiFaces';
import { getDefaultIdle, getRandomInteractionFace, getListeningFace } from '../../core/assets/hossiiIdle';
import styles from './HossiiLive.module.css';

type Props = {
  lastTriggerId?: string;
  emotion?: EmotionKey | null;
  onParticle?: (emotion: EmotionKey) => void;
  isListening?: boolean;
  hossiiColor?: HossiiColor;
  brainMessage?: string | null;
  /** F07: 読み上げ候補の投稿リスト */
  hossiis?: Hossii[];
  /** F07: 読み上げ ON/OFF（voiceEnabled と連動） */
  readingEnabled?: boolean;
  /** いいね時のリアクショントリガー（値が変化するたびに反応） */
  onLikeTrigger?: string | null;
};

/** Hossii のサイズ (CSS の width/height と一致させる) */
const HOSSII_SIZE_PC = 180; // PCサイズ
const HOSSII_SIZE_SP = 120; // スマホサイズ
const MARGIN = 32; // 画面端からの余白
const MOBILE_BREAKPOINT = 768; // モバイル判定のブレークポイント

/** 現在のビューポート幅に応じたHossiiサイズを取得 */
function getCurrentHossiiSize(): number {
  if (typeof window === 'undefined') {
    return HOSSII_SIZE_PC;
  }
  return window.innerWidth <= MOBILE_BREAKPOINT ? HOSSII_SIZE_SP : HOSSII_SIZE_PC;
}

/** タップ時のランダム感情 */
const TAP_EMOTIONS: EmotionKey[] = ['wow', 'joy', 'fun', 'empathy', 'laugh'];

/** タップ時のHossiiセリフ */
const TAP_LINES: string[] = [
  'ぽよ〜ん♪',
  'きゃっ！',
  'ふわ〜',
  'わっ！',
  'えへへ〜',
  'ぴょん！',
];

/** Hossiiカラーに対応するhue-rotate値を計算 */
const getHueRotation = (color?: HossiiColor): number => {
  if (!color || color === 'pink') return 0; // デフォルト（ピンク）
  switch (color) {
    case 'blue':
      return 180;
    case 'yellow':
      return 45;
    case 'green':
      return 120;
    case 'purple':
      return 270;
    default:
      return 0;
  }
};

/** 自発セリフ（アイドル時） */
const HOSSII_IDLE_LINES: string[] = [
  'きょうのスペース、いいかんじ',
  'ふう…',
  'だれか来るかな',
  'ここ、すき',
  'しずかだね',
  'のんびり〜',
  'ほわわ…',
  'いいてんき♪',
];

/** EmotionKey -> アニメーションclass名 */
const ANIM_CLASS_BY_EMOTION: Record<EmotionKey, string> = {
  wow: 'hossii-anim-wow',
  empathy: 'hossii-anim-empathy',
  inspire: 'hossii-anim-inspire',
  think: 'hossii-anim-think',
  laugh: 'hossii-anim-laugh',
  joy: 'hossii-anim-joy',
  moved: 'hossii-anim-moved',
  fun: 'hossii-anim-fun',
};

/** viewport サイズを取得 */
function getViewportSize() {
  if (typeof window === 'undefined') {
    return { width: 800, height: 600 };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/** ランダム位置を生成 (viewport 全体) */
function getRandomPosition() {
  const { width, height } = getViewportSize();
  const hossiiSize = getCurrentHossiiSize();
  const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
  const bottomNavHeight = isMobile ? 60 : 0;

  const maxX = Math.max(0, width - hossiiSize - MARGIN);
  const maxY = Math.max(0, height - hossiiSize - MARGIN - bottomNavHeight);
  return {
    x: MARGIN + Math.random() * maxX,
    y: MARGIN + Math.random() * maxY,
  };
}

/** 位置をclamp (画面外に出ないように) */
function clampPosition(pos: { x: number; y: number }) {
  const { width, height } = getViewportSize();
  const hossiiSize = getCurrentHossiiSize();
  const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
  const bottomNavHeight = isMobile ? 60 : 0;

  const maxX = Math.max(0, width - hossiiSize - MARGIN);
  const maxY = Math.max(0, height - hossiiSize - MARGIN - bottomNavHeight);
  return {
    x: Math.max(MARGIN, Math.min(pos.x, maxX)),
    y: Math.max(MARGIN, Math.min(pos.y, maxY)),
  };
}

/** 初期位置 (中央付近) */
function getInitialPosition() {
  const { width, height } = getViewportSize();
  const hossiiSize = getCurrentHossiiSize();
  return {
    x: (width - hossiiSize) / 2,
    y: (height - hossiiSize) / 2,
  };
}

/** ランダムな移動時間 (4500-8000ms) - transition duration */
function getRandomMoveDuration() {
  return 4500 + Math.random() * 3500;
}

/** ランダムな休憩時間 (1000-2500ms) */
function getRandomRestTime() {
  return 1000 + Math.random() * 1500;
}

export function HossiiLive({
  lastTriggerId,
  emotion,
  onParticle,
  isListening = false,
  hossiiColor,
  brainMessage,
  hossiis = [],
  readingEnabled = false,
  onLikeTrigger,
}: Props) {
  // === State ===
  const [position, setPosition] = useState(getInitialPosition);
  const [transitionDuration, setTransitionDuration] = useState(6000); // ms
  const [isSwimming, setIsSwimming] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  const [tapTransform, setTapTransform] = useState<string | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [longBubble, setLongBubble] = useState<{ emoji: string; text: string } | null>(null);
  const [idleBubble, setIdleBubble] = useState<string | null>(null);
  const [effect, setEffect] = useState<{ emoji: string; animClass: string } | null>(null);

  // 表情状態（優先順位: interaction > reaction > idle）
  const [interactionFace, setInteractionFace] = useState<string | null>(null);
  const [reactionFace, setReactionFace] = useState<string | null>(null);

  // いいねトリガーへの反応（喜び系表情を一時表示）
  useEffect(() => {
    if (!onLikeTrigger) return;
    const joyFaces = ['joy', 'fun', 'laugh'] as EmotionKey[];
    const face = getHossiiFace(joyFaces[Math.floor(Math.random() * joyFaces.length)]);
    setReactionFace(face);
    const timer = setTimeout(() => setReactionFace(null), 1200 + Math.random() * 300);
    return () => clearTimeout(timer);
  }, [onLikeTrigger]);

  // 表示する顔を優先順位で決定
  // interaction > reaction > listening > idle
  const displayFace = useMemo(() => {
    if (interactionFace) return interactionFace;
    if (reactionFace) return reactionFace;
    if (isListening) return getListeningFace();
    return getDefaultIdle();
  }, [interactionFace, reactionFace, isListening]);

  // === Refs ===
  const prevTriggerIdRef = useRef<string | undefined>(undefined);
  const longBubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleBubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInteractionTimeRef = useRef<number>(Date.now());
  // emotion を ref で保持（effect の依存配列から外すため）
  const emotionRef = useRef<EmotionKey | null | undefined>(emotion);
  emotionRef.current = emotion;

  // F07: hossiis / readingEnabled を ref で保持
  const hossiisRef = useRef<Hossii[]>(hossiis);
  hossiisRef.current = hossiis;
  const readingEnabledRef = useRef(readingEnabled);
  readingEnabledRef.current = readingEnabled;
  // 直前に読み上げた投稿 ID（重複防止）
  const lastReadIdRef = useRef<string | null>(null);
  // SpeechSynthesis utterance ref（キャンセル用）
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // ============================================
  // Layer A: BaseMotion - viewport全体を泳ぐ
  // ============================================
  useEffect(() => {
    // 初回描画後に transition を有効化 (ワープ防止)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsSwimming(true);
        scheduleNextMove();
      });
    });

    function scheduleNextMove() {
      // 次の移動時間をランダムに決定
      const moveDuration = getRandomMoveDuration();
      const restTime = getRandomRestTime();

      // transition duration を更新してから位置を変更
      setTransitionDuration(moveDuration);

      // 少し待ってから位置更新（transition duration が適用されるのを待つ）
      requestAnimationFrame(() => {
        setPosition(getRandomPosition());
      });

      // 移動完了 + 休憩後に次の移動をスケジュール
      moveTimerRef.current = setTimeout(() => {
        scheduleNextMove();
      }, moveDuration + restTime);
    }

    return () => {
      if (moveTimerRef.current) {
        clearTimeout(moveTimerRef.current);
      }
    };
  }, []);

  // ============================================
  // 画面リサイズ時に位置を clamp
  // ============================================
  useEffect(() => {
    function handleResize() {
      setPosition((prev) => clampPosition(prev));
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ============================================
  // Layer B: ReactionMotion - 投稿時の反応
  // ============================================
  useEffect(() => {
    if (!lastTriggerId || lastTriggerId === prevTriggerIdRef.current) {
      return;
    }
    prevTriggerIdRef.current = lastTriggerId;

    // 現在の emotion を取得（ref から）
    const currentEmotion = emotionRef.current;

    // longBubbleをクリア
    if (longBubbleTimerRef.current) {
      clearTimeout(longBubbleTimerRef.current);
      longBubbleTimerRef.current = null;
    }
    setLongBubble(null);

    // 既存のreactionタイマーをクリア
    if (reactionTimerRef.current) {
      clearTimeout(reactionTimerRef.current);
      reactionTimerRef.current = null;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    // 1) 表情切替（reactionFace を設定）
    if (currentEmotion) {
      setReactionFace(getHossiiFace(currentEmotion));
    }

    // 2) にこっ（scale は CSS .reacting .hossiiImage で）
    setIsReacting(true);
    timers.push(setTimeout(() => setIsReacting(false), 500));

    // 3) 吹き出し
    if (currentEmotion) {
      timers.push(setTimeout(() => {
        setBubble(getRandomBubble8(currentEmotion));
        timers.push(setTimeout(() => setBubble(null), 1200));
      }, 300));
    }

    // 4) エフェクト絵文字
    if (currentEmotion) {
      timers.push(setTimeout(() => {
        setEffect({
          emoji: EMOJI_BY_EMOTION[currentEmotion],
          animClass: ANIM_CLASS_BY_EMOTION[currentEmotion],
        });
        timers.push(setTimeout(() => setEffect(null), 1500));
      }, 200));
    }

    // 5) パーティクル
    if (currentEmotion && onParticle) {
      timers.push(setTimeout(() => onParticle(currentEmotion), 400));
    }

    // 6) reactionFace を 1.2〜1.5秒後にクリア（idle に戻る）
    const reactionDuration = 1200 + Math.random() * 300; // 1.2〜1.5秒
    reactionTimerRef.current = setTimeout(() => {
      setReactionFace(null);
    }, reactionDuration);
    timers.push(reactionTimerRef.current);

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [lastTriggerId, onParticle]);

  // ============================================
  // 自発セリフ（アイドル時）
  // ============================================
  useEffect(() => {
    function speakText(text: string) {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      // 前の読み上げを停止
      if (utteranceRef.current) {
        window.speechSynthesis.cancel();
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }

    function scheduleIdleSpeech() {
      // 30-60秒のランダムな間隔
      const delay = 30000 + Math.random() * 30000;

      idleBubbleTimerRef.current = setTimeout(() => {
        // 40%の確率で発動
        if (Math.random() < 0.4) {
          // F07: readingEnabled かつ投稿がある場合、50% の確率で投稿を読み上げ
          const candidatePosts = hossiisRef.current.filter(
            (h) => h.message && h.message.trim().length > 0 && h.id !== lastReadIdRef.current
          );

          if (readingEnabledRef.current && candidatePosts.length > 0 && Math.random() < 0.5) {
            const post = candidatePosts[Math.floor(Math.random() * candidatePosts.length)];
            lastReadIdRef.current = post.id;
            const displayText = post.message.length > 40 ? post.message.slice(0, 40) + '…' : post.message;
            setIdleBubble(`「${displayText}」`);
            speakText(post.message);
          } else {
            const randomLine = HOSSII_IDLE_LINES[Math.floor(Math.random() * HOSSII_IDLE_LINES.length)];
            setIdleBubble(randomLine);
          }

          // 4秒後にフェードアウト
          setTimeout(() => {
            setIdleBubble(null);
          }, 4000);
        }

        // 次の自発セリフをスケジュール
        scheduleIdleSpeech();
      }, delay);
    }

    // 初回スケジュール
    scheduleIdleSpeech();

    return () => {
      if (idleBubbleTimerRef.current) {
        clearTimeout(idleBubbleTimerRef.current);
      }
      // コンポーネントアンマウント時に読み上げを停止
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 投稿やタップ時に自発セリフをクリア
  useEffect(() => {
    if (lastTriggerId || bubble || longBubble) {
      setIdleBubble(null);
      lastInteractionTimeRef.current = Date.now();
    }
  }, [lastTriggerId, bubble, longBubble]);

  // F07: readingEnabled が false になったら読み上げを停止
  useEffect(() => {
    if (!readingEnabled && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [readingEnabled]);

  // ============================================
  // Layer C: TapMotion - タップ時の反応
  // ============================================
  const handleTap = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const clickX = e.clientX;
    const clickY = e.clientY;

    // 押された方向と逆に逃げる
    const dx = centerX - clickX;
    const dy = centerY - clickY;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;

    // 逃げる / 寄る をランダムに（穏やかな動き）
    const isFlee = Math.random() > 0.3;
    const moveDistance = isFlee ? 8 : -5; // 小さめの移動量
    const tiltAngle = (Math.random() - 0.5) * 8; // 傾きも控えめ

    // タップ時の追加transform（scale up で押した感を出す - 縮小禁止）
    const translateX = normalizedDx * moveDistance;
    const translateY = normalizedDy * moveDistance;
    setTapTransform(`translate(${translateX}px, ${translateY}px) rotate(${tiltAngle}deg) scale(1.06)`);

    // ゆっくり戻す（ふわっと）
    setTimeout(() => setTapTransform(null), 800);

    // longBubbleタイマーをクリア
    if (longBubbleTimerRef.current) {
      clearTimeout(longBubbleTimerRef.current);
    }

    // idleBubbleをクリア
    setIdleBubble(null);
    lastInteractionTimeRef.current = Date.now();

    // 既存のinteractionタイマーをクリア
    if (interactionTimerRef.current) {
      clearTimeout(interactionTimerRef.current);
    }

    // インタラクション用の笑顔表情（emotion に依存しない）
    setInteractionFace(getRandomInteractionFace());

    // エフェクト用のランダム感情（見た目のみ）
    const tapEmotion = TAP_EMOTIONS[Math.floor(Math.random() * TAP_EMOTIONS.length)];
    const tapLine = TAP_LINES[Math.floor(Math.random() * TAP_LINES.length)];

    setEffect({
      emoji: EMOJI_BY_EMOTION[tapEmotion],
      animClass: ANIM_CLASS_BY_EMOTION[tapEmotion],
    });
    setTimeout(() => setEffect(null), 1500);

    setLongBubble({
      emoji: EMOJI_BY_EMOTION[tapEmotion],
      text: tapLine,
    });
    longBubbleTimerRef.current = setTimeout(() => {
      setLongBubble(null);
    }, 5000);

    if (onParticle) {
      onParticle(tapEmotion);
    }

    // 0.5〜0.7秒後に interactionFace をクリア → idle に戻る（reaction には戻らない）
    const interactionDuration = 500 + Math.random() * 200; // 0.5〜0.7秒
    interactionTimerRef.current = setTimeout(() => {
      setInteractionFace(null);
    }, interactionDuration);
  }, [onParticle]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (longBubbleTimerRef.current) {
        clearTimeout(longBubbleTimerRef.current);
      }
      if (idleBubbleTimerRef.current) {
        clearTimeout(idleBubbleTimerRef.current);
      }
      if (interactionTimerRef.current) {
        clearTimeout(interactionTimerRef.current);
      }
      if (reactionTimerRef.current) {
        clearTimeout(reactionTimerRef.current);
      }
    };
  }, []);

  // コンテナのクラス名
  const containerClasses = [
    styles.container,
    isSwimming ? styles.swimming : '',
    isReacting ? styles.reacting : '',
    tapTransform ? styles.tapped : '',
  ].filter(Boolean).join(' ');

  // BaseMotion の transform + TapMotion の追加transform
  const baseTransform = `translate3d(${position.x}px, ${position.y}px, 0)`;
  const finalTransform = tapTransform
    ? `${baseTransform} ${tapTransform}`
    : baseTransform;

  // Hossiiカラーのfilter適用
  const hueRotate = getHueRotation(hossiiColor);
  const colorFilter = hueRotate !== 0 ? `hue-rotate(${hueRotate}deg)` : undefined;

  return (
    <>
      {/* Hossii本体 */}
      <div
        className={containerClasses}
        style={{
          transform: finalTransform,
          transitionDuration: isSwimming && !tapTransform ? `${transitionDuration}ms` : undefined,
        }}
        onClick={handleTap}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleTap(e as unknown as React.MouseEvent<HTMLDivElement>)}
      >
        <img
          src={displayFace}
          alt="Hossii"
          className={styles.hossiiImage}
          style={{ filter: colorFilter }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className={styles.fallbackEmoji}>🌟</span>

        {/* 短い吹き出し（投稿時） */}
        {bubble && !longBubble && (
          <div className={styles.bubble}>
            <span className={styles.bubbleText}>{bubble}</span>
          </div>
        )}

        {/* 長い吹き出し（タップ時） */}
        {longBubble && (
          <div className={styles.longBubble}>
            <span className={styles.longBubbleEmoji}>{longBubble.emoji}</span>
            <span className={styles.longBubbleText}>{longBubble.text}</span>
          </div>
        )}

        {/* AI Brain 吹き出し（AI からのメッセージ） */}
        {brainMessage && !bubble && !longBubble && (
          <div className={styles.brainBubble}>
            <span className={styles.brainBubbleIcon}>✨</span>
            <span className={styles.brainBubbleText}>{brainMessage}</span>
          </div>
        )}

        {/* アイドル吹き出し（自発セリフ） */}
        {idleBubble && !bubble && !longBubble && !brainMessage && (
          <div className={styles.idleBubble}>
            <span className={styles.idleBubbleText}>{idleBubble}</span>
          </div>
        )}
      </div>

      {/* エフェクト絵文字（画面中央付近） */}
      {effect && (
        <div className={`${styles.effect} ${effect.animClass}`}>
          {effect.emoji}
        </div>
      )}
    </>
  );
}
