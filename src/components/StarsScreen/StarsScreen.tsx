import { useMemo } from 'react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { TopRightMenu } from '../Navigation/TopRightMenu';
import styles from './StarsScreen.module.css';

const MAX_STARS = 120;

/** seed付き疑似乱数（毎回同じ配置になる） */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

/** 星の座標を生成 */
function generateStarPosition(index: number): { x: number; y: number; size: number; delay: number } {
  const seed = 12345 + index * 7919;
  const x = 5 + seededRandom(seed) * 90; // 5-95%
  const y = 8 + seededRandom(seed + 1) * 82; // 8-90%
  const size = 2 + seededRandom(seed + 2) * 3; // 2-5px
  const delay = seededRandom(seed + 3) * 3; // 0-3s
  return { x, y, size, delay };
}

/** 星座の線を生成（隣接する星を接続） */
function generateConstellationLines(starCount: number): { x1: number; y1: number; x2: number; y2: number }[] {
  if (starCount < 10) return [];

  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const positions = Array.from({ length: Math.min(starCount, MAX_STARS) }, (_, i) => generateStarPosition(i));

  // 星座の接続パターン（固定ルール）
  const connectionRules = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], // 基本線
    [0, 5], [1, 4], [2, 6], [3, 7], // クロス
    [5, 6], [6, 7], [7, 8], [8, 9], // 延長
    [0, 9], [4, 8], [2, 7], // 追加接続
    [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], // さらに延長
    [10, 15], [11, 16], [12, 17], [13, 18], [14, 19], // 分岐
    [15, 20], [16, 21], [17, 22], [18, 23], [19, 24], // 更に延長
  ];

  for (const [a, b] of connectionRules) {
    if (a < positions.length && b < positions.length) {
      lines.push({
        x1: positions[a].x,
        y1: positions[a].y,
        x2: positions[b].x,
        y2: positions[b].y,
      });
    }
  }

  return lines;
}

export const StarsScreen = () => {
  const { getActiveSpaceHossiis } = useHossiiStore();

  // アクティブなスペースのログのみ取得
  const hossiis = getActiveSpaceHossiis();
  const starCount = Math.min(hossiis.length, MAX_STARS);

  // 星の位置を計算（メモ化）
  const stars = useMemo(() => {
    return Array.from({ length: starCount }, (_, i) => ({
      id: i,
      ...generateStarPosition(i),
    }));
  }, [starCount]);

  // 星座の線を計算（メモ化）
  const lines = useMemo(() => generateConstellationLines(starCount), [starCount]);

  // 段階判定
  const stage = starCount < 10 ? 0 : starCount < 25 ? 1 : starCount < 50 ? 2 : 3;

  return (
    <div className={styles.container}>
      <TopRightMenu />

      {/* タイトル */}
      <header className={styles.header}>
        <h1 className={styles.title}>
          {stage === 3 ? 'Hossii座' : '星空'}
        </h1>
        <p className={styles.subtitle}>
          {starCount === 0
            ? 'ログを置くと星が生まれるよ'
            : `${starCount} 個の星`}
        </p>
      </header>

      {/* 星座の線（SVG） */}
      {lines.length > 0 && (
        <svg className={`${styles.constellation} ${stage >= 2 ? styles.constellationGlow : ''}`}>
          {lines.map((line, i) => (
            <line
              key={i}
              x1={`${line.x1}%`}
              y1={`${line.y1}%`}
              x2={`${line.x2}%`}
              y2={`${line.y2}%`}
              className={styles.constellationLine}
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </svg>
      )}

      {/* 星 */}
      {stars.map((star) => (
        <div
          key={star.id}
          className={styles.star}
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}

      {/* 完成時のラベル */}
      {stage === 3 && (
        <div className={styles.constellationLabel}>
          Hossii座
        </div>
      )}

      {/* 空の状態 */}
      {starCount === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🌙</span>
          <p className={styles.emptyText}>まだ星がありません</p>
        </div>
      )}
    </div>
  );
};
