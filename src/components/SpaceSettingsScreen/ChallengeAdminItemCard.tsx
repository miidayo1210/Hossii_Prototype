import type { ChallengeItem } from '../../core/types/challengeProgram';
import type { ChallengeResponseVisibility } from '../../core/types/challengeResponse';
import {
  challengeItemTypeLabel,
  challengeResponseTypeLabel,
  clampAdminDescription,
} from '../../core/utils/challengeAdminDisplay';
import {
  challengeResponseVisibilityLabel,
  resolveChallengeResponseVisibility,
} from '../../core/utils/challengeVisibility';
import styles from './ChallengeAdminItemCard.module.css';

type Props = {
  item: ChallengeItem;
  order: number;
  programDefaultVisibility: ChallengeResponseVisibility;
  readOnly: boolean;
  busy: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

function responseMethodLabel(item: ChallengeItem): string {
  return `${challengeResponseTypeLabel(item.responseType)}で回答`;
}

export function ChallengeAdminItemCard({
  item,
  order,
  programDefaultVisibility,
  readOnly,
  busy,
  canMoveUp,
  canMoveDown,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: Props) {
  const typeLabel = challengeItemTypeLabel(item.itemType);
  const requiredLabel = item.isRequired ? 'クリアに必要' : 'おまけ';
  const effectiveVisibility = resolveChallengeResponseVisibility({
    itemResponseVisibility: item.responseVisibility,
    programDefaultResponseVisibility: programDefaultVisibility,
  });
  const visibilityLabel = item.responseVisibility
    ? challengeResponseVisibilityLabel(item.responseVisibility)
    : `標準（${challengeResponseVisibilityLabel(effectiveVisibility)}）`;
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
        <span className={styles.muted}>{responseMethodLabel(item)}</span>
        <span className={styles.muted}>{visibilityLabel}</span>
      </div>
      <h3 className={styles.title}>{item.title}</h3>
      {summary ? <p className={styles.summary}>{summary}</p> : null}
      {!readOnly ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.moveButton}
            onClick={onMoveUp}
            disabled={busy || !canMoveUp}
            aria-label="上へ"
          >
            上へ
          </button>
          <button
            type="button"
            className={styles.moveButton}
            onClick={onMoveDown}
            disabled={busy || !canMoveDown}
            aria-label="下へ"
          >
            下へ
          </button>
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
