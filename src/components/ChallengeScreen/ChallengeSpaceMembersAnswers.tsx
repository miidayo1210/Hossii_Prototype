import { useId, useState } from 'react';
import type { ChallengeResponse } from '../../core/types/challengeResponse';
import {
  CHALLENGE_SPACE_MEMBER_ANSWERS_PAGE_SIZE,
  formatChallengeAnswerDate,
  formatSpaceMemberAnswerLabel,
} from '../../core/utils/challengeSpaceMemberAnswers';
import { ChallengePhotoImage } from './ChallengePhotoImage';
import styles from './ChallengeSpaceMembersAnswers.module.css';

type Props = {
  answers: ChallengeResponse[];
  currentUserId: string | null | undefined;
  responderNames: Readonly<Record<string, string>>;
};

export function ChallengeSpaceMembersAnswers({
  answers,
  currentUserId,
  responderNames,
}: Props) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(
    CHALLENGE_SPACE_MEMBER_ANSWERS_PAGE_SIZE,
  );

  if (answers.length === 0) return null;

  const visible = expanded ? answers.slice(0, visibleCount) : [];
  const hasMore = expanded && visibleCount < answers.length;

  return (
    <section className={styles.section} aria-label="みんなの回答">
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => {
          setExpanded((value) => !value);
          setVisibleCount(CHALLENGE_SPACE_MEMBER_ANSWERS_PAGE_SIZE);
        }}
      >
        <span className={styles.toggleLabel}>
          みんなの回答 {answers.length}件
        </span>
        <span className={styles.chevron} aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      {expanded ? (
        <ul id={panelId} className={styles.list}>
          {visible.map((answer) => {
            const mine = Boolean(
              currentUserId && answer.userId === currentUserId,
            );
            const label = formatSpaceMemberAnswerLabel({
              userId: answer.userId,
              currentUserId,
              names: responderNames,
            });
            const dateLabel = formatChallengeAnswerDate(answer.createdAt);
            return (
              <li
                key={answer.id}
                className={`${styles.row} ${mine ? styles.rowMine : ''}`}
              >
                <div className={styles.meta}>
                  <span className={styles.name}>
                    {label}
                    {mine ? (
                      <span className={styles.mineBadge}>自分の回答</span>
                    ) : null}
                  </span>
                  {dateLabel ? (
                    <span className={styles.date}>{dateLabel}</span>
                  ) : null}
                </div>
                {answer.photoPath ? (
                  <div className={styles.photo}>
                    <ChallengePhotoImage
                      photoPath={answer.photoPath}
                      size="md"
                      alt={`${label}の回答写真`}
                    />
                  </div>
                ) : (
                  <p className={styles.comment}>
                    {answer.comment.trim() || '（回答なし）'}
                  </p>
                )}
              </li>
            );
          })}
          {hasMore ? (
            <li>
              <button
                type="button"
                className={styles.moreButton}
                onClick={() =>
                  setVisibleCount(
                    (count) => count + CHALLENGE_SPACE_MEMBER_ANSWERS_PAGE_SIZE,
                  )
                }
              >
                もっと見る（あと{answers.length - visibleCount}件）
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}
