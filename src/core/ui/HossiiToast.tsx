/**
 * HossiiToast - 共通トーストコンポーネント
 * 旧Leapday HossiiToast.tsx から移植
 */

import { useEffect, useState } from 'react';
import styles from './HossiiToast.module.css';

type ToastType = 'success' | 'error' | 'info';

type Props = {
  message: string;
  show: boolean;
  onClose: () => void;
  type?: ToastType;
  /** 表示時間（ms）デフォルト900ms */
  duration?: number;
};

export function HossiiToast({
  message,
  show,
  onClose,
  type = 'success',
  duration = 900,
}: Props) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!show) return;

    // フェードイン（10ms後）
    const fadeInTimer = setTimeout(() => setIsVisible(true), 10);

    // duration後にフェードアウト開始
    const fadeOutTimer = setTimeout(() => {
      setIsVisible(false);
      // 200ms後にonClose
      setTimeout(onClose, 200);
    }, duration);

    return () => {
      clearTimeout(fadeInTimer);
      clearTimeout(fadeOutTimer);
      setIsVisible(false);
    };
  }, [show, onClose, duration]);

  if (!show && !isVisible) return null;

  const typeClass = {
    success: styles.success,
    error: styles.error,
    info: styles.info,
  }[type];

  const icon = {
    success: '🌟',
    error: '😢',
    info: '💬',
  }[type];

  return (
    <div
      className={`${styles.container} ${isVisible ? styles.visible : ''}`}
    >
      <div className={`${styles.toast} ${typeClass}`}>
        <span className={styles.icon}>{icon}</span>
        <span className={styles.message}>{message}</span>
      </div>
    </div>
  );
}
