import styles from './BubbleActionMenu.module.css';

type Props = {
  onViewDetail?: () => void;
  onConnect?: () => void;
  connectionCount?: number;
  onConnectionsClick?: () => void;
};

export function BubbleActionMenu({
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

  return (
    <div
      className={`${styles.menu} hossii-pop`}
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
    </div>
  );
}
