import styles from './SpaceArchiveBadge.module.css';

type Props = {
  /** 「閲覧専用」補足を表示する（既定: true） */
  showReadOnlyHint?: boolean;
};

/** スペース一覧などで、アーカイブ中スペースを示す小さなバッジ（112 仕様）。 */
export function SpaceArchiveBadge({ showReadOnlyHint = true }: Props) {
  return (
    <span className={styles.badge} title={showReadOnlyHint ? '閲覧専用' : undefined}>
      <span className={styles.label}>アーカイブ</span>
      {showReadOnlyHint && (
        <span className={styles.hint} aria-label="閲覧専用">
          閲覧専用
        </span>
      )}
    </span>
  );
}
