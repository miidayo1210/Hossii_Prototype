import styles from './PaneOverrideHint.module.css';

type Props = {
  /** When false, pane inherits Space settings. When true, pane has an explicit override. */
  hasOverride: boolean;
  onReset?: () => void;
  resetLabel?: string;
};

export function PaneOverrideHint({
  hasOverride,
  onReset,
  resetLabel = 'Space 設定に戻す',
}: Props) {
  if (hasOverride && onReset) {
    return (
      <div className={styles.hint}>
        <button type="button" className={styles.resetButton} onClick={onReset}>
          {resetLabel}
        </button>
      </div>
    );
  }

  if (!hasOverride) {
    return (
      <div className={styles.hint}>
        <p className={styles.inherit}>Space 設定を使用中（このタブで上書きできます）</p>
      </div>
    );
  }

  return null;
}
