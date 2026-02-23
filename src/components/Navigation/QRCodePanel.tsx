import QRCode from 'react-qr-code';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import styles from './QRCodePanel.module.css';

export const QRCodePanel = () => {
  const { state } = useHossiiStore();

  // Generate space URL with current space ID
  const spaceUrl = state.activeSpaceId
    ? `${window.location.origin}?space=${state.activeSpaceId}`
    : window.location.origin;

  return (
    <aside className={styles.qrPanel}>
      <div className={styles.qrContainer}>
        <QRCode
          value={spaceUrl}
          size={120}
          level="M"
          fgColor="#1f2937"
          bgColor="transparent"
        />
      </div>
      <div className={styles.qrLabel}>
        <span className={styles.labelIcon}>📱</span>
        <span className={styles.labelText}>スマホで参加</span>
      </div>
    </aside>
  );
};
