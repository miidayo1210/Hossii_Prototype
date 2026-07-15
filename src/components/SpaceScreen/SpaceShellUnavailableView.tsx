import styles from './SpaceShellUnavailableView.module.css';

type Props = {
  onGoAccount: () => void;
  onGoCommunity?: () => void;
};

export function SpaceShellUnavailableView({ onGoAccount, onGoCommunity }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <p className={styles.title}>スペースが見つかりません</p>
        <p className={styles.message}>
          このスペースは存在しないか、現在の環境では開けません。別の導線から共有スペースを開き直してください。
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} onClick={onGoAccount}>
            アカウント画面へ
          </button>
          {onGoCommunity && (
            <button type="button" className={styles.secondaryBtn} onClick={onGoCommunity}>
              コミュニティHOMEへ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
