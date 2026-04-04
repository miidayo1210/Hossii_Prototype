import { useState, useEffect, useRef } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useDisplayPrefs } from '../../core/contexts/DisplayPrefsContext';
import styles from './StarLayer.module.css';

type Star = {
  id: string;
  x: number; // % position
  y: number; // % position
  size: number; // px
  delay: number; // animation delay
  duration: number; // animation duration
  opacity: number; // base opacity
};

/**
 * ランダムな星の位置を生成（端に寄りすぎない）
 */
function generateStarPosition(): { x: number; y: number } {
  // 10% 〜 90% の範囲
  const x = 10 + Math.random() * 80;
  const y = 10 + Math.random() * 80;
  return { x, y };
}

/**
 * 星を生成
 */
function createStar(): Star {
  const { x, y } = generateStarPosition();
  return {
    id: `star-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    x,
    y,
    size: 4 + Math.random() * 4, // 4〜8px
    delay: Math.random() * 3, // 0〜3秒のアニメーション遅延
    duration: 5 + Math.random() * 3, // 5〜8秒のアニメーション周期
    opacity: 0.5 + Math.random() * 0.3, // 0.5〜0.8
  };
}

export const StarLayer = () => {
  const { state, getActiveSpaceHossiis } = useHossiiStore();
  const { activeSpaceId } = state;
  const { prefs: { showHossii } } = useDisplayPrefs();
  // アクティブなスペースのログを取得
  const hossiis = getActiveSpaceHossiis();

  const [stars, setStars] = useState<Star[]>([]);
  const prevHossiiCountRef = useRef<number>(0);

  // スペースが切り替わったら星をリセット（このレンダー時点の hossiis を使う。ref だと別タスクで古い配列を読む可能性がある）
  useEffect(() => {
    const h = hossiis;
    const initialStars = h.slice(0, 20).map(() => createStar());
    const count = h.length;
    const id = setTimeout(() => {
      setStars(initialStars);
      prevHossiiCountRef.current = count;
    }, 0);
    return () => clearTimeout(id);
    // activeSpaceId 変更時のそのコミットの hossiis のみが必要。投稿のたびに星を初期化しないよう hossiis は入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on space switch; hossiis is paired with activeSpaceId in the same render
  }, [activeSpaceId]);

  // 初期化: 既存の投稿数に基づいて星を生成
  useEffect(() => {
    if (stars.length > 0 || hossiis.length === 0) return;
    const initialStars = hossiis.slice(0, 20).map(() => createStar());
    const count = hossiis.length;
    const id = setTimeout(() => {
      setStars(initialStars);
      prevHossiiCountRef.current = count;
    }, 0);
    return () => clearTimeout(id);
  }, [hossiis, stars.length]);

  // 新しい投稿があったら星を追加
  useEffect(() => {
    const currentCount = hossiis.length;
    const prevCount = prevHossiiCountRef.current;

    if (currentCount > prevCount) {
      // 新しい投稿の数だけ星を追加
      const newStarsCount = currentCount - prevCount;
      const newStars = Array.from({ length: newStarsCount }, () => createStar());
      setStars((prev) => [...prev, ...newStars]);
    }

    prevHossiiCountRef.current = currentCount;
  }, [hossiis.length]);

  // showHossii が true なら描画しない
  if (showHossii) {
    return null;
  }

  return (
    <div className={styles.layer}>
      {stars.map((star) => (
        <span
          key={star.id}
          className={styles.star}
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
          }}
        />
      ))}
    </div>
  );
};
