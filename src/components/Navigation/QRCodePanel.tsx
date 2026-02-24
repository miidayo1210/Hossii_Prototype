import QRCode from 'react-qr-code';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import styles from './QRCodePanel.module.css';

export const QRCodePanel = () => {
  const { state, getActiveSpace } = useHossiiStore();
  const activeSpace = getActiveSpace();

  // /s/[spaceURL] 形式を優先。未設定の場合は旧 ?space=xxx にフォールバック
  const spaceUrl = activeSpace?.spaceURL
    ? `${window.location.origin}/s/${activeSpace.spaceURL}`
    : state.activeSpaceId
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
