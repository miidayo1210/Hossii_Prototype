import { createPortal } from 'react-dom';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import styles from './BubbleActionMenu.module.css';

const GAP = 10;
const MIN_WIDTH = 152;

function clampHorizontal(left: number, width: number): number {
  return Math.max(8, Math.min(left, window.innerWidth - width - 8));
}

type Props = {
  anchorRect: DOMRect;
  onViewDetail?: () => void;
  onConnect?: () => void;
  membershipJoinStatus?: 'joining' | 'error';
  onMembershipRetry?: () => void;
  connectionCount?: number;
  onConnectionsClick?: () => void;
  /** 直接 connection が 1 件以上のとき表示 */
  showPullHandle?: boolean;
  onPullHandlePointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  pullStarParticleCount?: number;
  isPulling?: boolean;
};

export function BubbleActionMenu({
  anchorRect,
  onViewDetail,
  onConnect,
  membershipJoinStatus,
  onMembershipRetry,
  connectionCount,
  onConnectionsClick,
  showPullHandle = false,
  onPullHandlePointerDown,
  pullStarParticleCount = 1,
  isPulling = false,
}: Props) {
  const showConnections =
    onConnectionsClick != null && connectionCount != null;

  if (
    !onViewDetail &&
    !onConnect &&
    !membershipJoinStatus &&
    !showConnections &&
    !showPullHandle
  ) {
    return null;
  }

  const width = Math.min(MIN_WIDTH, window.innerWidth - 16);
  const centerX = anchorRect.left + anchorRect.width / 2;
  const left = clampHorizontal(centerX - width / 2, width);
  const style: CSSProperties = {
    position: 'fixed',
    left,
    width,
    bottom: window.innerHeight - anchorRect.top + GAP,
    zIndex: 320,
  };

  return createPortal(
    <div
      className={`${styles.menu} hossii-pop`}
      style={style}
      data-bubble-action-menu
      data-space-export="exclude"
      data-connection-pull-active={isPulling ? 'true' : 'false'}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {showPullHandle && onPullHandlePointerDown && (
        <div className={styles.pullHandleRow}>
          <button
            type="button"
            className={`${styles.pullHandle} ${isPulling ? styles.pullHandleActive : ''}`}
            data-connection-pull-handle
            aria-label="つながりを引っ張る"
            onPointerDown={(e) => {
              e.stopPropagation();
              onPullHandlePointerDown(e);
            }}
          >
            <span className={styles.pullHandleIcon} aria-hidden>
              ✦
            </span>
            {isPulling && pullStarParticleCount > 0 && (
              <span className={styles.pullStars} aria-hidden data-testid="pull-star-particles">
                {Array.from({ length: pullStarParticleCount }, (_, index) => (
                  <span key={index}>✦</span>
                ))}
              </span>
            )}
          </button>
        </div>
      )}
      {onViewDetail && (
        <button
          type="button"
          className={styles.menuItem}
          onClick={onViewDetail}
        >
          くわしく見る
        </button>
      )}
      {onConnect && (
        <button
          type="button"
          className={styles.menuItem}
          onClick={onConnect}
        >
          つないでみる
        </button>
      )}
      {membershipJoinStatus === 'joining' && (
        <p className={styles.membershipStatus} aria-live="polite">
          参加確認中…
        </p>
      )}
      {membershipJoinStatus === 'error' && onMembershipRetry && (
        <button
          type="button"
          className={styles.membershipRetry}
          onClick={onMembershipRetry}
        >
          もう一度試す
        </button>
      )}
      {showConnections && (
        <button
          type="button"
          className={styles.menuItem}
          onClick={onConnectionsClick}
        >
          つながり {connectionCount}
        </button>
      )}
    </div>,
    document.body,
  );
}
