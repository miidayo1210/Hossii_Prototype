import type { StampCardTheme } from '../../core/types/stamp';
import { STAMPS_PER_CARD } from '../../core/types/stamp';
import styles from './StampCard.module.css';

type Props = {
  progress: number; // 0-20
  theme: StampCardTheme;
};

export const StampCard = ({ progress, theme }: Props) => {
  const stamps = Array.from({ length: STAMPS_PER_CARD }, (_, i) => ({
    index: i,
    filled: i < progress,
  }));

  const getStampPosition = (index: number): { x: number; y: number } => {
    switch (theme) {
      case 'grid':
        return getGridPosition(index);
      case 'spiral':
        return getSpiralPosition(index);
      case 'wave':
        return getWavePosition(index);
      case 'starry':
        return getStarryPosition(index);
      case 'circle':
        return getCirclePosition(index);
      default:
        return getGridPosition(index);
    }
  };

  return (
    <div className={`${styles.card} ${styles[theme]}`}>
      {stamps.map((stamp) => {
        const pos = getStampPosition(stamp.index);
        return (
          <div
            key={stamp.index}
            className={`${styles.stamp} ${stamp.filled ? styles.filled : styles.empty}`}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              animationDelay: `${stamp.index * 0.05}s`,
            }}
          >
            {stamp.filled ? '🐟' : ''}
          </div>
        );
      })}
    </div>
  );
};

// Grid: 5x4の格子配置
const getGridPosition = (index: number): { x: number; y: number } => {
  const cols = 5;
  const rows = 4;
  const col = index % cols;
  const row = Math.floor(index / cols);

  return {
    x: 10 + (col * 80) / (cols - 1),
    y: 10 + (row * 80) / (rows - 1),
  };
};

// Spiral: 渦巻き配置
const getSpiralPosition = (index: number): { x: number; y: number } => {
  const angle = (index / STAMPS_PER_CARD) * Math.PI * 4; // 2回転
  const radius = 5 + (index / STAMPS_PER_CARD) * 35; // 半径を徐々に大きく

  return {
    x: 50 + radius * Math.cos(angle),
    y: 50 + radius * Math.sin(angle),
  };
};

// Wave: 波打つ配置
const getWavePosition = (index: number): { x: number; y: number } => {
  const x = 10 + (index / (STAMPS_PER_CARD - 1)) * 80;
  const waveHeight = 20;
  const frequency = 2;
  const y = 50 + waveHeight * Math.sin((index / STAMPS_PER_CARD) * Math.PI * frequency);

  return { x, y };
};

// Starry: ランダムな星空配置（疑似ランダム）
const getStarryPosition = (index: number): { x: number; y: number } => {
  // シード値を使った疑似ランダム
  const seed = index * 12345;
  const random1 = ((seed * 9301 + 49297) % 233280) / 233280;
  const random2 = ((seed * 9307 + 49299) % 233281) / 233281;

  return {
    x: 10 + random1 * 80,
    y: 10 + random2 * 80,
  };
};

// Circle: 円形配置
const getCirclePosition = (index: number): { x: number; y: number } => {
  const angle = (index / STAMPS_PER_CARD) * Math.PI * 2 - Math.PI / 2; // 上から始まる
  const radius = 40;

  return {
    x: 50 + radius * Math.cos(angle),
    y: 50 + radius * Math.sin(angle),
  };
};
