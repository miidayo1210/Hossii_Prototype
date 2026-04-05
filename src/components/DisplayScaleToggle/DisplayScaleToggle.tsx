import { useDisplayPrefs } from '../../core/contexts/DisplayPrefsContext';
import { DISPLAY_SCALE_VALUES, type DisplayScale } from '../../core/utils/displayScaleStorage';
import styles from './DisplayScaleToggle.module.css';

/**
 * Display Scale Toggle Component
 * Allows users to switch between 75%, 100%, 125%, and 150% display scale
 * for better readability on projectors and high-resolution displays
 */
export const DisplayScaleToggle = () => {
  const { prefs: { displayScale }, setDisplayScale } = useDisplayPrefs();

  const scales: Array<{ value: DisplayScale; label: string }> = DISPLAY_SCALE_VALUES.map((value) => ({
    value,
    label: String(Math.round(value * 100)),
  }));

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
