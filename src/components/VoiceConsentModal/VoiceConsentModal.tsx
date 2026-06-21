import styles from '../ListenConsentModal/ListenConsentModal.module.css';

type Props = {
  onConsent: () => void;
  onCancel: () => void;
};

export const VoiceConsentModal = ({ onConsent, onCancel }: Props) => {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.icon}>🔊</div>
        <h2 className={styles.title}>周囲に音が出てもよいですか？</h2>
        <p className={styles.description}>
          Hossii の読み上げを ON にすると、スピーカーから投稿内容などが音声で再生されます。
          周囲の人にも聞こえる場合があります。静かな場所や公共の場ではご注意ください。
        </p>
        <ul className={styles.features}>
          <li>いつでも OFF にできます</li>
          <li>ブラウザの音声合成（Speech Synthesis）を使用</li>
          <li>マイクは使用しません（Listen とは別機能）</li>
        </ul>
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
            許可して ON
          </button>
        </div>
      </div>
    </div>
  );
};
