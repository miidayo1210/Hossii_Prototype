import { useId, useState } from 'react';
import type { ChallengeItem } from '../../core/types/challengeProgram';
import type { ChallengeResponse } from '../../core/types/challengeResponse';
import type { ChallengeCompletion } from '../../core/types/challengeReward';
import styles from './ChallengeRecordsSection.module.css';

export type ChallengeRecordRow = {
  item: ChallengeItem;
  response: ChallengeResponse | null;
  completion: ChallengeCompletion | null;
  date: Date | null;
};

type Props = {
  records: ChallengeRecordRow[];
  onOpenRecord: (itemId: string) => void;
};

function formatRecordDate(date: Date | null): string {
  if (!date) return '日付なし';
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return '日付なし';
  }
}

export function ChallengeRecordsSection({ records, onOpenRecord }: Props) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);

  if (records.length === 0) return null;

  return (
    <section className={styles.section} aria-label="これまでの記録">
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className={styles.toggleLabel}>
          これまでの記録 {records.length}件
        </span>
        <span className={styles.chevron} aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      {expanded ? (
        <ul id={panelId} className={styles.list}>
          {records.map((record) => {
            const title = record.item.title.trim() || 'この挑戦';
            return (
              <li key={record.item.id}>
                <button
                  type="button"
                  className={styles.row}
                  onClick={() => onOpenRecord(record.item.id)}
                  disabled={!record.completion}
                  aria-label={`${title}の記録を見る`}
                >
                  <span className={styles.rowTitle}>{title}</span>
                  <span className={styles.rowDate}>
                    {formatRecordDate(record.date)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
