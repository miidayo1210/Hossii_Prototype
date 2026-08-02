import type { ChallengeItem } from '../../core/types/challengeProgram';
import type { ChallengeResponseVisibility } from '../../core/types/challengeResponse';
import { clampAdminDescription } from '../../core/utils/challengeAdminDisplay';
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
  onEdit: () => void;
  onDelete: () => void;
};

export function ChallengeAdminItemCard({
  item,
  order,
  programDefaultVisibility,
  readOnly,
  busy,
  onEdit,
  onDelete,
}: Props) {
  const typeLabel = item.itemType === 'question' ? '質問' : 'ミッション';
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
        <span className={styles.muted}>
          {item.responseType === 'complete_button'
            ? '完了ボタンで回答'
            : item.responseType === 'choice3'
              ? '3択で回答'
              : item.responseType === 'photo'
                ? '写真で回答（未対応）'
                : 'コメントで回答'}
        </span>
        <span className={styles.muted}>{visibilityLabel}</span>
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
