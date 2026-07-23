import styles from './ConnectionFetchErrorNotice.module.css';

type Props = {
  onRetry: () => void;
  retryDisabled?: boolean;
};

export function ConnectionFetchErrorNotice({ onRetry, retryDisabled = false }: Props) {
  return (
    <div
      className={styles.notice}
      role="status"
      aria-live="polite"
      data-space-export="exclude"
    >
      <span className={styles.message}>つながりを読み込めませんでした</span>
      <button
        type="button"
        className={styles.retryButton}
        onClick={onRetry}
        disabled={retryDisabled}
        aria-busy={retryDisabled || undefined}
      >
        再試行
      </button>
    </div>
  );
}
