/**
 * HossiiBackground - 共通背景コンポーネント
 * 旧Leapday BackgroundImage.tsx から移植
 *
 * 画像アセットなしのためグラデーションで代用
 * 将来的に画像対応可能な構造を維持
 */

import { useEffect, useState } from 'react';
import styles from './HossiiBackground.module.css';

type Props = {
  /** 背景画像URL（指定時はグラデーションより優先） */
  imageUrl?: string;
  /** オーバーレイを表示するか */
  overlay?: boolean;
  /** グラデーションタイプ */
  variant?: 'warm' | 'cool' | 'neutral';
};

export function HossiiBackground({
  imageUrl,
  overlay = true,
  variant = 'warm',
}: Props) {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [isLoaded, setIsLoaded] = useState(!imageUrl);

  useEffect(() => {
    function updateOrientation() {
      const ratio = window.innerWidth / window.innerHeight;
      setOrientation(ratio < 0.8 ? 'portrait' : 'landscape');
    }

    updateOrientation();

    let resizeTimer: ReturnType<typeof setTimeout>;
    const debouncedUpdate = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateOrientation, 300);
    };

    window.addEventListener('resize', debouncedUpdate);
    return () => {
      window.removeEventListener('resize', debouncedUpdate);
      clearTimeout(resizeTimer);
    };
  }, []);

  // 画像プリロード
  useEffect(() => {
    if (!imageUrl) {
      setIsLoaded(true);
      return;
    }

    const img = new Image();
    img.src = imageUrl;
    img.onload = () => setIsLoaded(true);
  }, [imageUrl]);

  const variantClass = {
    warm: styles.warm,
    cool: styles.cool,
    neutral: styles.neutral,
  }[variant];

  const orientationClass = orientation === 'portrait' ? styles.portrait : styles.landscape;

  return (
    <>
      {/* 背景 */}
      <div
        className={`${styles.background} ${variantClass} ${orientationClass}`}
        style={{
          opacity: isLoaded ? 1 : 0,
          ...(imageUrl && {
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }),
        }}
      />

      {/* オーバーレイ（可読性向上） */}
      {overlay && <div className={styles.overlay} />}
    </>
  );
}
