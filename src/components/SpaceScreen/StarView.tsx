import type { Hossii } from '../../core/types';
import styles from './StarView.module.css';

type Props = {
  hossii: Hossii;
  x: number; // % position
  y: number; // % position
  onClick: () => void;
};

export const StarView = ({ hossii, x, y, onClick }: Props) => {
  const isLaughter = hossii.autoType === 'laughter';
  const emotion = hossii.emotion;

  // Create varied animation delays based on position for organic feel
  const pulseDelay = ((x + y) * 37) % 100 / 100; // 0-1 range based on position
  const floatDelay = ((x * 53 + y * 71) % 100) / 100; // Different delay for float
  const pulseDuration = 3 + ((x * y) % 20) / 10; // 3-5 seconds varied duration

  return (
    <button
      className={styles.star}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        '--pulse-delay': `${pulseDelay}s`,
        '--float-delay': `${floatDelay}s`,
        '--pulse-duration': `${pulseDuration}s`,
      } as React.CSSProperties}
      onClick={onClick}
      aria-label={`${hossii.authorName || 'Post'} from ${hossii.createdAt.toLocaleTimeString()}`}
      data-emotion={emotion}
    >
      <span className={styles.starDot}></span>
      {isLaughter && <span className={styles.laughterBadge}>😂</span>}
    </button>
  );
};
