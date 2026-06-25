import { useState, useRef, useCallback } from 'react';
import styles from './HossiiMini.module.css';

const IDLE_BASE = '/hossii/idle/idle_base.png';
const IDLE_SMILE = '/hossii/idle/idle_smile.png';

type Props = {
  onClick?: () => void;
};

export const HossiiMini = ({ onClick }: Props) => {
  const [isSmiling, setIsSmiling] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);
  const smileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sparkleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(() => {
    // 既存タイマーをクリア（連打対応）
    if (smileTimerRef.current) {
      clearTimeout(smileTimerRef.current);
    }
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
    }
    if (sparkleTimerRef.current) {
      clearTimeout(sparkleTimerRef.current);
    }

    // 表情切替
    setIsSmiling(true);
    smileTimerRef.current = setTimeout(() => {
      setIsSmiling(false);
    }, 700);

    // ぷにっアニメーション
    setIsAnimating(true);
    animTimerRef.current = setTimeout(() => {
      setIsAnimating(false);
    }, 280);

    // きらきらエフェクト
    setShowSparkles(true);
    sparkleTimerRef.current = setTimeout(() => {
      setShowSparkles(false);
    }, 450);

    // 外部コールバック
    onClick?.();
  }, [onClick]);

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={`${styles.container} ${isAnimating ? styles.animating : ''}`}
        onClick={handleClick}
        aria-label="Hossiiに話しかける"
      >
        <img
          src={isSmiling ? IDLE_SMILE : IDLE_BASE}
          alt="Hossii"
          className={styles.image}
        />
      </button>
      {showSparkles && (
        <div className={styles.sparkles}>
          <span className={styles.sparkle1}>✨</span>
          <span className={styles.sparkle2}>⭐</span>
          <span className={styles.sparkle3}>✨</span>
        </div>
      )}
    </div>
  );
};
