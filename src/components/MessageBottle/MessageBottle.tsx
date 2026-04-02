import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import type { BottlePayload } from '../../core/utils/neighborsApi';
import { EMOJI_BY_EMOTION } from '../../core/assets/emotions';
import styles from './MessageBottle.module.css';

type Props = {
  payload: BottlePayload;
  onOpen: () => void;
  onDismiss: () => void;
};

export const MessageBottle = ({ payload, onOpen, onDismiss }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // 20 秒後に自動消滅（未開封の場合は recordBottleDelivery を呼ばない）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen) {
        setIsDismissed(true);
        // アニメーション後に親に通知
        setTimeout(onDismiss, 500);
      }
    }, 20000);
    return () => clearTimeout(timer);
  }, [isOpen, onDismiss]);

  const handleBottleClick = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsDismissed(true);
    onOpen(); // recordBottleDelivery を呼ぶ
    setTimeout(onDismiss, 400);
  }, [onOpen, onDismiss]);

  const handleVisit = useCallback(() => {
    onOpen(); // recordBottleDelivery を呼ぶ
    if (payload.fromSpace.spaceURL) {
      window.open(`/s/${payload.fromSpace.spaceURL}`, '_blank');
    }
    setIsDismissed(true);
    setTimeout(onDismiss, 400);
  }, [onOpen, onDismiss, payload.fromSpace.spaceURL]);

  const emotionEmoji = payload.hossii.emotion
    ? EMOJI_BY_EMOTION[payload.hossii.emotion]
    : null;

  return (
    <>
      {/* ボトルアイコン（画面右下） */}
      {!isOpen && (
        <button
          className={`${styles.bottleButton} ${isDismissed ? styles.dismissed : ''}`}
          onClick={handleBottleClick}
          aria-label="漂着メッセージを開封する"
          title="隣の島からメッセージが届きました"
        >
          🍾
        </button>
      )}

      {/* 開封モーダル */}
      {isOpen && (
        <div className={styles.overlay} onClick={handleClose}>
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <button className={styles.closeIcon} onClick={handleClose} aria-label="閉じる">
              <X size={18} />
            </button>

            <p className={styles.fromLabel}>🏝 となりの島から届きました</p>
            <hr className={styles.divider} />

            {emotionEmoji && (
              <div className={styles.emotionEmoji}>{emotionEmoji}</div>
            )}

            {payload.hossii.message && (
              <p className={styles.message}>"{payload.hossii.message}"</p>
            )}

            <div className={styles.meta}>
              {payload.hossii.authorName && (
                <span className={styles.authorName}>― {payload.hossii.authorName}</span>
              )}
              <span className={styles.spaceName}>{payload.fromSpace.name}より</span>
            </div>

            <div className={styles.actions}>
              {payload.fromSpace.spaceURL && (
                <button className={styles.visitButton} onClick={handleVisit}>
                  そのスペースに遊びに行く →
                </button>
              )}
              <button className={styles.closeButton} onClick={handleClose}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
