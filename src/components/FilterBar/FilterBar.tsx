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
          checked={filters.comment}
          onChange={() => handleToggle('comment')}
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
          checked={filters.emotion}
          onChange={() => handleToggle('emotion')}
          className={styles.checkbox}
        />
        <span className={styles.label}>
          <span className={styles.labelFull}>気持ち</span>
          <span className={styles.labelShort}>気持ち</span>
        </span>
      </label>
    </div>
  );
};
