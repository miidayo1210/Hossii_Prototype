import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Hossii } from '../../core/types';
import { EMOJI_BY_EMOTION } from '../../core/assets/emotions';
import styles from './SlideshowView.module.css';

type Props = {
  hossiis: Hossii[];
  onExit: () => void;
};

const INTERVAL_OPTIONS = [3, 5, 10, 20] as const;
type IntervalSec = typeof INTERVAL_OPTIONS[number];

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const SlideshowView = ({ hossiis, onExit }: Props) => {
  const shuffled = useMemo(() => shuffleArray(hossiis), [hossiis]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [interval, setIntervalSec] = useState<IntervalSec>(5);
  const [showControls, setShowControls] = useState(true);
  const [visible, setVisible] = useState(true);

  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playingRef = useRef(isPlaying);
  playingRef.current = isPlaying;

  const total = shuffled.length;

  const goNext = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setCurrentIndex((i) => (i + 1) % total);
      setVisible(true);
    }, 300);
  }, [total]);

  const goPrev = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setCurrentIndex((i) => (i - 1 + total) % total);
      setVisible(true);
    }, 300);
  }, [total]);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  // 自動送り
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(goNext, interval * 1000);
    return () => clearInterval(id);
  }, [isPlaying, interval, goNext]);

  // キーボード操作
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { goNext(); resetControlsTimer(); }
      if (e.key === 'ArrowLeft') { goPrev(); resetControlsTimer(); }
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, onExit, resetControlsTimer]);

  // マウント時に設定パネルを3秒後に隠す
  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [resetControlsTimer]);

  const handleTap = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isRightHalf = e.clientX > rect.left + rect.width / 2;
    if (isRightHalf) goNext(); else goPrev();
    resetControlsTimer();
  };

  if (total === 0) {
    return (
      <div className={styles.overlay}>
        <p className={styles.empty}>表示できる投稿がありません</p>
        <button type="button" className={styles.exitButton} onClick={onExit}>
          終了
        </button>
      </div>
    );
  }

  const current = shuffled[currentIndex];

  return (
    <div className={styles.overlay} onPointerDown={handleTap}>
      {/* スライドカード */}
      <div className={`${styles.slide} ${visible ? styles.visible : styles.hidden}`}>
        {current.emotion && (
          <div className={styles.emotion}>
            {EMOJI_BY_EMOTION[current.emotion]}
          </div>
        )}
        {current.imageUrl && (
          <img
            src={current.imageUrl}
            alt=""
            className={styles.image}
            loading="lazy"
          />
        )}
        {current.message && (
          <p className={styles.message}>{current.message}</p>
        )}
        {current.authorName && (
          <p className={styles.author}>{current.authorName}</p>
        )}
      </div>

      {/* スライド番号 */}
      <div className={styles.counter}>
        {currentIndex + 1} / {total}
      </div>

      {/* 設定パネル */}
      <div
        className={`${styles.controls} ${showControls ? styles.controlsVisible : styles.controlsHidden}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className={styles.controlsRow}>
          {/* 間隔選択 */}
          <div className={styles.intervalGroup}>
            {INTERVAL_OPTIONS.map((sec) => (
              <button
                key={sec}
                type="button"
                className={`${styles.intervalButton} ${interval === sec ? styles.intervalActive : ''}`}
                onClick={() => { setIntervalSec(sec); resetControlsTimer(); }}
              >
                {sec}秒
              </button>
            ))}
          </div>

          {/* 一時停止/再開 */}
          <button
            type="button"
            className={styles.playButton}
            onClick={() => { setIsPlaying((p) => !p); resetControlsTimer(); }}
          >
            {isPlaying ? '⏸ 一時停止' : '▶ 再開'}
          </button>

          {/* 終了 */}
          <button
            type="button"
            className={styles.exitButton}
            onClick={onExit}
          >
            ✕ 終了
          </button>
        </div>
      </div>
    </div>
  );
};
