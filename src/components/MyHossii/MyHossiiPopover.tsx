import { useEffect, useRef } from 'react';
import type { MyHossiiActivity } from '../../core/utils/myHossiiActivity';
import styles from './MyHossiiPopover.module.css';

type Props = {
  nickname: string;
  stateLabel: string;
  activity: MyHossiiActivity;
  showLogs: boolean;
  onViewLogs: () => void;
  onClose: () => void;
};

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

function truncateMessage(text: string, max = 48): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed || '（本文なし）';
  return `${trimmed.slice(0, max - 1)}…`;
}

export const MyHossiiPopover = ({
  nickname,
  stateLabel,
  activity,
  showLogs,
  onViewLogs,
  onClose,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const pad = 8;
    let shiftX = 0;
    let shiftY = 0;

    if (rect.right > window.innerWidth - pad) {
      shiftX = window.innerWidth - pad - rect.right;
    }
    if (rect.left < pad) {
      shiftX = pad - rect.left;
    }
    if (rect.bottom > window.innerHeight - pad) {
      shiftY = window.innerHeight - pad - rect.bottom;
    }
    if (rect.top < pad) {
      shiftY = pad - rect.top;
    }

    if (shiftX !== 0 || shiftY !== 0) {
      el.style.transform = `translate(calc(-50% + ${shiftX}px), ${shiftY}px)`;
    }
  }, []);

  return (
    <div
      ref={ref}
      className={styles.popover}
      role="dialog"
      aria-label={`${nickname}のプロフィール`}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" className={styles.closeButton} onClick={onClose} aria-label="閉じる">
        ×
      </button>
      <p className={styles.nickname}>{nickname}</p>
      <p className={styles.stateLabel}>{stateLabel}</p>

      {showLogs ? (
        <>
          {activity.recentPosts.length > 0 ? (
            <ul className={styles.logList}>
              {activity.recentPosts.map((post) => (
                <li key={post.id} className={styles.logItem}>
                  {truncateMessage(post.message)}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyLogs}>この場所での記録はまだありません</p>
          )}

          {activity.lastActivityAt && (
            <p className={styles.lastActivity}>
              最終活動: {formatRelativeTime(activity.lastActivityAt)}
            </p>
          )}

          <button type="button" className={styles.viewLogsButton} onClick={onViewLogs}>
            この人のログを見る
          </button>
        </>
      ) : null}
    </div>
  );
};
