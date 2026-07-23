import styles from './SpaceHossiiConnectionHandle.module.css';

type Props = {
  onClick: () => void;
  active?: boolean;
};

/** スペースHossii横のつながり入口（Phase 1: click のみ、pull なし） */
export function SpaceHossiiConnectionHandle({ onClick, active = false }: Props) {
  return (
    <button
      type="button"
      className={`${styles.handle} ${active ? styles.handleActive : ''}`}
      data-space-hossii-connection-handle
      data-space-export="exclude"
      aria-label="つながりを見る"
      aria-pressed={active}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <span className={styles.icon} aria-hidden>
        ✦
      </span>
    </button>
  );
}
