/**
 * NewHossiiArrivalToast — 新しい Hossii が届いたときのトースト
 *
 * コンシューマー文脈（スペース画面）。既存 HossiiToast より感情・作者を伝える。
 * motion.css の hossii-soft-bounce / hossii-sparkle を CSS Module 内で再利用。
 */

import { useEffect, useMemo, useState } from 'react';
import styles from './NewHossiiArrivalToast.module.css';

type EmotionKey =
  | 'wow'
  | 'empathy'
  | 'inspire'
  | 'think'
  | 'laugh'
  | 'joy'
  | 'moved'
  | 'fun';

const EMOJI_BY_EMOTION: Record<EmotionKey, string> = {
  wow: '😮',
  empathy: '😍',
  inspire: '🤯',
  think: '🤔',
  laugh: '😂',
  joy: '🥰',
  moved: '😢',
  fun: '✨',
};

const EMOTION_COLORS: Record<EmotionKey, string> = {
  joy: '#fbbf24',
  wow: '#60a5fa',
  empathy: '#f472b6',
  inspire: '#a78bfa',
  think: '#10b981',
  laugh: '#f59e0b',
  moved: '#ec4899',
  fun: '#8b5cf6',
};

export type NewHossiiArrivalPayload = {
  id: string;
  authorName?: string;
  message?: string;
  emotion?: EmotionKey;
};

type Props = {
  hossii: NewHossiiArrivalPayload | null;
  show: boolean;
  onClose: () => void;
  /** 表示時間（ms）。既定 3200ms */
  duration?: number;
};

function buildHeadline(authorName?: string): string {
  const trimmed = authorName?.trim();
  if (trimmed) {
    return `${trimmed}さんの気持ちが届いた`;
  }
  return '新しい気持ちが届いた';
}

function truncateMessage(message?: string, maxLen = 42): string | null {
  const trimmed = message?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}

export function NewHossiiArrivalToast({
  hossii,
  show,
  onClose,
  duration = 3200,
}: Props) {
  const [phase, setPhase] = useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden');

  const headline = useMemo(
    () => buildHeadline(hossii?.authorName),
    [hossii?.authorName],
  );

  const preview = useMemo(
    () => truncateMessage(hossii?.message),
    [hossii?.message],
  );

  const emotionEmoji = hossii?.emotion
    ? EMOJI_BY_EMOTION[hossii.emotion]
    : '💫';

  const emotionColor = hossii?.emotion
    ? EMOTION_COLORS[hossii.emotion]
    : '#a855f7';

  useEffect(() => {
    if (!show || !hossii) {
      setPhase('hidden');
      return;
    }

    setPhase('entering');
    const visibleTimer = window.setTimeout(() => setPhase('visible'), 420);

    const exitTimer = window.setTimeout(() => {
      setPhase('exiting');
      window.setTimeout(onClose, 220);
    }, duration);

    return () => {
      window.clearTimeout(visibleTimer);
      window.clearTimeout(exitTimer);
    };
  }, [show, hossii?.id, duration, onClose, hossii]);

  if (!show || !hossii || phase === 'hidden') {
    return null;
  }

  const containerClass = [
    styles.container,
    phase === 'entering' ? styles.entering : '',
    phase === 'visible' ? styles.visible : '',
    phase === 'exiting' ? styles.exiting : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={containerClass}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={styles.toast}>
        <div className={styles.accentGlow} aria-hidden="true" />

        <div
          className={styles.emotionBadge}
          style={{
            boxShadow: `0 2px 12px ${emotionColor}33, inset 0 0 0 1px ${emotionColor}44`,
          }}
          aria-hidden="true"
        >
          {emotionEmoji}
        </div>

        <div className={styles.content}>
          <p className={styles.headline}>
            <span className={styles.headlineAccent}>✦ </span>
            {headline}
          </p>
          {preview ? <p className={styles.preview}>{preview}</p> : null}
        </div>

        <button
          type="button"
          className={styles.dismissButton}
          aria-label="閉じる"
          onClick={() => {
            setPhase('exiting');
            window.setTimeout(onClose, 220);
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
