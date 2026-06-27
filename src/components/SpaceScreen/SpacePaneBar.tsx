import type { SpacePane } from '../../core/types/spacePane';
import styles from './SpacePaneBar.module.css';

type Props = {
  visiblePanes: SpacePane[];
  activePaneId: string | null;
  isAdmin: boolean;
  disabled?: boolean;
  variant: 'desktop' | 'mobile';
  onSelect: (paneId: string) => void;
  onAddPane?: () => void;
};

export function SpacePaneBar({
  visiblePanes,
  activePaneId,
  isAdmin,
  disabled = false,
  variant,
  onSelect,
  onAddPane,
}: Props) {
  const barClass =
    variant === 'desktop'
      ? `${styles.spacePaneBar} ${styles.spacePaneBarDesktop}`
      : `${styles.spacePaneBar} ${styles.spacePaneBarMobile}`;

  return (
    <nav
      className={barClass}
      aria-label="スペース内タブ"
      data-space-export="exclude"
    >
      <div className={styles.scroll} role="tablist">
        {visiblePanes.map((pane) => {
          const isActive = pane.id === activePaneId;
          return (
            <button
              key={pane.id}
              type="button"
              role="tab"
              id={`space-pane-tab-${pane.id}`}
              aria-selected={isActive}
              aria-controls="space-pane-panel"
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              disabled={disabled}
              title={pane.name}
              onClick={() => onSelect(pane.id)}
            >
              {pane.name}
            </button>
          );
        })}
        {isAdmin && onAddPane && (
          <button
            type="button"
            className={styles.addButton}
            aria-label="タブを追加"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onAddPane();
            }}
          >
            ＋
          </button>
        )}
      </div>
    </nav>
  );
};
