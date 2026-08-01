import type { ChallengeItem } from '../../core/types/challengeProgram';
import { clampAdminDescription } from '../../core/utils/challengeAdminDisplay';
import styles from './ChallengeAdminItemCard.module.css';

type Props = {
  item: ChallengeItem;
  order: number;
  readOnly: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

export function ChallengeAdminItemCard({
  item,
  order,
  readOnly,
  busy,
  onEdit,
  onDelete,
}: Props) {
  const typeLabel = item.itemType === 'question' ? '質問' : 'ミッション';
  const requiredLabel = item.isRequired ? 'クリアに必要' : 'おまけ';
  const summary =
    clampAdminDescription(item.description, 60) ??
    clampAdminDescription(item.reason, 60);

  return (
    <article
      className={styles.card}
      aria-label={`${order}. ${typeLabel} ${item.title}`}
    >
      <div className={styles.meta}>
        <span className={styles.order}>{order}</span>
        <span className={styles.badge}>{typeLabel}</span>
        <span
          className={`${styles.badge} ${
            item.isRequired ? styles.badgeRequired : styles.badgeOptional
          }`}
        >
          {requiredLabel}
        </span>
        <span className={styles.muted}>コメントで回答</span>
      </div>
      <h3 className={styles.title}>{item.title}</h3>
      {summary ? <p className={styles.summary}>{summary}</p> : null}
      {!readOnly ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.editButton}
            onClick={onEdit}
            disabled={busy}
          >
            編集
          </button>
          <button
            type="button"
            className={styles.deleteButton}
            onClick={onDelete}
            disabled={busy}
          >
            削除
          </button>
        </div>
      ) : null}
    </article>
  );
}
