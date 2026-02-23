import type { HossiiFilters } from '../../core/utils/filterStorage';
import styles from './FilterBar.module.css';

type FilterBarProps = {
  filters: HossiiFilters;
  onFilterChange: (filters: HossiiFilters) => void;
};

export const FilterBar = ({ filters, onFilterChange }: FilterBarProps) => {
  const handleToggle = (key: keyof HossiiFilters) => {
    onFilterChange({
      ...filters,
      [key]: !filters[key],
    });
  };

  return (
    <div className={styles.container}>
      <label className={styles.filterItem}>
        <input
          type="checkbox"
          checked={filters.manual}
          onChange={() => handleToggle('manual')}
          className={styles.checkbox}
        />
        <span className={styles.label}>
          <span className={styles.labelFull}>コメント</span>
          <span className={styles.labelShort}>コメント</span>
        </span>
      </label>
      <label className={styles.filterItem}>
        <input
          type="checkbox"
          checked={filters.autoEmotion}
          onChange={() => handleToggle('autoEmotion')}
          className={styles.checkbox}
        />
        <span className={styles.label}>
          <span className={styles.labelFull}>音声：感情</span>
          <span className={styles.labelShort}>感情</span>
        </span>
      </label>
      <label className={styles.filterItem}>
        <input
          type="checkbox"
          checked={filters.autoSpeech}
          onChange={() => handleToggle('autoSpeech')}
          className={styles.checkbox}
        />
        <span className={styles.label}>
          <span className={styles.labelFull}>音声：ことば</span>
          <span className={styles.labelShort}>ことば</span>
        </span>
      </label>
      <label className={styles.filterItem}>
        <input
          type="checkbox"
          checked={filters.autoLaughter}
          onChange={() => handleToggle('autoLaughter')}
          className={styles.checkbox}
        />
        <span className={styles.label}>
          <span className={styles.labelFull}>音声：笑い</span>
          <span className={styles.labelShort}>笑い</span>
        </span>
      </label>
    </div>
  );
};
