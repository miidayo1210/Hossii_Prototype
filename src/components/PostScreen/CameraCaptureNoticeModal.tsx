import { CAMERA_CAPTURE_NOTICE_TEXT } from '../../core/constants/cameraCaptureNotice';
import styles from './CameraCaptureNoticeModal.module.css';

type Props = {
  onAcknowledge: () => void;
  onDismissForever: () => void;
  onCancel: () => void;
};

export function CameraCaptureNoticeModal({
  onAcknowledge,
  onDismissForever,
  onCancel,
}: Props) {
  return (
    <div className={styles.overlay} onClick={onCancel} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-capture-notice-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.icon} aria-hidden="true">
          📷
        </div>
        <h2 id="camera-capture-notice-title" className={styles.title}>
          撮影のまえに
        </h2>
        <p className={styles.description}>{CAMERA_CAPTURE_NOTICE_TEXT}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.acknowledgeButton}
            onClick={onAcknowledge}
          >
            わかった
          </button>
          <button
            type="button"
            className={styles.dismissForeverButton}
            onClick={onDismissForever}
          >
            今後表示しない
          </button>
        </div>
      </div>
    </div>
  );
}
