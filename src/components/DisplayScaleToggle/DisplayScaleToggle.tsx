import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import type { DisplayScale } from '../../core/utils/displayScaleStorage';
import styles from './DisplayScaleToggle.module.css';

/**
 * Display Scale Toggle Component
 * Allows users to switch between 100%, 125%, and 150% display scale
 * for better readability on projectors and high-resolution displays
 */
export const DisplayScaleToggle = () => {
  const { state, setDisplayScale } = useHossiiStore();
  const { displayScale } = state;

  const scales: Array<{ value: DisplayScale; label: string }> = [
    { value: 1, label: '100' },
    { value: 1.25, label: '125' },
    { value: 1.5, label: '150' },
  ];

  return (
    <div className={styles.container}>
      <span className={styles.label}>Display:</span>
      <div className={styles.buttons}>
        {scales.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`${styles.button} ${displayScale === value ? styles.active : ''}`}
            onClick={() => setDisplayScale(value)}
            aria-label={`Set display scale to ${label}%`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
