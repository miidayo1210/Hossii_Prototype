import styles from './SpaceArchiveBanner.module.css';

export function SpaceArchiveBanner() {
  return (
    <div className={styles.banner} role="status" data-space-export="exclude">
      <p className={styles.message}>このスペースはアーカイブされています</p>
      <p className={styles.hint}>過去の記録を閲覧できます</p>
    </div>
  );
}
