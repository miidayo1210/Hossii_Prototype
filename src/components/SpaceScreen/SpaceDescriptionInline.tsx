import styles from './SpaceDescriptionInline.module.css';

type Props = {
  description: string;
  className?: string;
};

/** スペース名の右隣に置く一行説明（最大50文字・折り返しなし） */
export function SpaceDescriptionInline({ description, className }: Props) {
  return (
    <span
      className={[styles.inline, className].filter(Boolean).join(' ')}
      data-space-export="exclude"
      aria-label={`スペースの説明: ${description}`}
    >
      <span className={styles.separator} aria-hidden>
        ·
      </span>
      <span className={styles.text}>{description}</span>
    </span>
  );
}
