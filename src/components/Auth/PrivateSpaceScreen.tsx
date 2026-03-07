import styles from './GuestEntryScreen.module.css';

type Props = {
  onLoginRequested: () => void;
};

export const PrivateSpaceScreen = ({ onLoginRequested }: Props) => {
  return (
    <div className={styles.container}>
      <div className={`${styles.blob} ${styles.blob1}`} />
      <div className={`${styles.blob} ${styles.blob2}`} />
      <div className={`${styles.blob} ${styles.blob3}`} />

      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.logo}>✨ Hossii</h1>
          <p className={styles.spaceName}>このスペースは非公開です</p>
        </div>

        <div className={styles.buttons}>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', textAlign: 'center', margin: '0 0 1.5rem' }}>
            このスペースにアクセスするには<br />ログインが必要です。
          </p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onLoginRequested}
          >
            ログインする
          </button>
        </div>
      </div>
    </div>
  );
};
