import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
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
  connectionCount?: number;
  onConnectionsClick?: () => void;
};

export function BubbleActionMenu({
  anchorRect,
  onViewDetail,
  onConnect,
  connectionCount,
  onConnectionsClick,
}: Props) {
  const showConnections =
    onConnectionsClick != null && connectionCount != null;

  if (!onViewDetail && !onConnect && !showConnections) {
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
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
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
