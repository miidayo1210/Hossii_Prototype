import { useCallback, useEffect, useState } from 'react';
import styles from './SpaceWelcomeBanner.module.css';

const STORAGE_PREFIX = 'hossii:space-welcome-dismissed:';

function readDismissed(spaceId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}${spaceId}`) === '1';
  } catch {
    return false;
  }
}

function persistDismissed(spaceId: string): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${spaceId}`, '1');
  } catch {
    /* localStorage unavailable */
  }
}

export type SpaceWelcomeBannerProps = {
  /** スペース識別子（localStorage キーに使用） */
  spaceId: string;
  /** 表示名（グラデーション見出しに使用） */
  spaceName: string;
  /** 外部制御で表示/非表示を上書きする場合 */
  forceVisible?: boolean;
  /** 「気持ちを置く」CTA 押下時 */
  onPostClick?: () => void;
  /** 閉じたあと（localStorage 保存後） */
  onDismiss?: () => void;
  /** TopBar 等の下に置くときの top オフセット */
  topOffset?: string;
  className?: string;
};

/**
 * スペース画面上部 — 初めて来たユーザー向けの案内バナー。
 * コンシューマー文脈: フロストガラス + 温かいコピー + ぷにぷに出現。
 */
export function SpaceWelcomeBanner({
  spaceId,
  spaceName,
  forceVisible,
  onPostClick,
  onDismiss,
  topOffset = '4.5rem',
  className,
}: SpaceWelcomeBannerProps) {
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const shouldShow = forceVisible ?? !readDismissed(spaceId);
    setVisible(shouldShow);
    if (!shouldShow) return undefined;

    const timer = window.setTimeout(() => setEntered(true), 16);
    return () => window.clearTimeout(timer);
  }, [spaceId, forceVisible]);

  const dismiss = useCallback(() => {
    persistDismissed(spaceId);
    setVisible(false);
    onDismiss?.();
  }, [spaceId, onDismiss]);

  const handlePostClick = useCallback(() => {
    onPostClick?.();
    dismiss();
  }, [onPostClick, dismiss]);

  if (!visible) return null;

  const bannerClass = [
    styles.banner,
    entered ? 'hossii-soft-bounce' : styles.bannerEnter,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={[styles.anchor, className].filter(Boolean).join(' ')}
      style={{ top: topOffset }}
      role="region"
      aria-label="スペースへのようこそ案内"
      data-space-export="exclude"
    >
      <div className={bannerClass}>
        <div className={styles.glow} aria-hidden />

        <div className={styles.content}>
          <span className={`${styles.mascot} hossii-float-slow`} aria-hidden>
            ✨
          </span>

          <div className={styles.textBlock}>
            <p className={styles.eyebrow}>はじめまして</p>
            <h2 className={styles.title}>
              <span className={styles.spaceName}>{spaceName}</span>
              <span className={styles.titleSuffix}>へようこそ</span>
            </h2>
            <p className={styles.body}>
              このスペースに、あなたの気持ちを置いてみませんか？
              星やふわふわの Hossii が、みんなの想いを映しています。
            </p>
          </div>

          <div className={styles.actions}>
            {onPostClick && (
              <button
                type="button"
                className={styles.ctaButton}
                onClick={handlePostClick}
              >
                気持ちを置いてみる
              </button>
            )}
            <button
              type="button"
              className={styles.laterButton}
              onClick={dismiss}
            >
              あとで
            </button>
          </div>
        </div>

        <button
          type="button"
          className={styles.closeButton}
          onClick={dismiss}
          aria-label="案内を閉じる"
        >
          ×
        </button>
      </div>
    </div>
  );
}
