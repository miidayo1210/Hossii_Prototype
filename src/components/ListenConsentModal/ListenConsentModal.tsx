import styles from './ListenConsentModal.module.css';

type Props = {
  onConsent: () => void;
  onCancel: () => void;
};

export const ListenConsentModal = ({ onConsent, onCancel }: Props) => {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.icon}>🎤</div>
        <h2 className={styles.title}>マイク使用の確認</h2>
        <p className={styles.description}>
          Listen モードを有効にすると、Hossii が周囲の音を聞いて
          自動的にログを投稿します。
        </p>
        <ul className={styles.features}>
          <li>笑い声や大きな音を検知</li>
          <li>音声データは保存されません</li>
          <li>いつでも OFF にできます</li>
        </ul>
        <p className={styles.note}>
          ※ ブラウザからマイクの許可を求められます
        </p>
        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={styles.consentButton}
            onClick={onConsent}
          >
            許可して開始
          </button>
        </div>
      </div>
    </div>
  );
};
