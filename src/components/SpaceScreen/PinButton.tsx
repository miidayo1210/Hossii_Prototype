import styles from './PinButton.module.css';

type Props = {
  isPinned: boolean;
  visible: boolean;
  onToggle: () => void;
  className?: string;
};

export function PinButton({ isPinned, visible, onToggle, className }: Props) {
  return (
    <button
      type="button"
      className={`${styles.button} ${visible || isPinned ? styles.visible : ''} ${isPinned ? styles.pinned : ''} ${className ?? ''}`}
      aria-label={isPinned ? 'ピン留めを解除する' : 'ピン留めする'}
      aria-pressed={isPinned}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onToggle();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className={styles.icon} aria-hidden="true">
        📌
      </span>
    </button>
  );
}
