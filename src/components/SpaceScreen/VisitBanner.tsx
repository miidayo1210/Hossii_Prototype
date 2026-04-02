import styles from './VisitBanner.module.css';

type Props = {
  spaceName: string;
  spaceURL?: string;
  onBack: () => void;
};

export const VisitBanner = ({ spaceName, spaceURL, onBack }: Props) => {
  const handleOpenInNewTab = () => {
    if (spaceURL) {
      window.open(`/s/${spaceURL}`, '_blank');
    }
  };

  return (
    <div className={styles.banner}>
      <span className={styles.title}>🏝 {spaceName}を訪問中</span>
      <div className={styles.actions}>
        {spaceURL && (
          <button className={styles.openButton} onClick={handleOpenInNewTab}>
            このスペースを開く ↗
          </button>
        )}
        <button className={styles.backButton} onClick={onBack}>
          ← 自スペースに戻る
        </button>
      </div>
    </div>
  );
};
