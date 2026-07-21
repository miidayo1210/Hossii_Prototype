import styles from './PostPrivacyNotice.module.css';
import { POST_PRIVACY_NOTICE_TEXT } from '../../core/constants/postPrivacyNotice';

export { POST_PRIVACY_NOTICE_TEXT };

export function PostPrivacyNotice() {
  return (
    <p className={styles.notice} role="note" aria-live="off">
      {POST_PRIVACY_NOTICE_TEXT}
    </p>
  );
}
