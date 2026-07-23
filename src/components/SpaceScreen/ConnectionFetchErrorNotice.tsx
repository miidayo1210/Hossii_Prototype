import styles from './ConnectionFetchErrorNotice.module.css';

type Props = {
  onRetry: () => void;
};

export function ConnectionFetchErrorNotice({ onRetry }: Props) {
  return (
    <div
      className={styles.notice}
      role="status"
      aria-live="polite"
      data-space-export="exclude"
    >
      <span className={styles.message}>つながりを読み込めませんでした</span>
      <button type="button" className={styles.retryButton} onClick={onRetry}>
        再試行
      </button>
    </div>
  );
}
