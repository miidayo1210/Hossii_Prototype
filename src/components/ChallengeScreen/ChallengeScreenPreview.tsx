import { useMemo, useState } from 'react';
import type { ChallengeItem, ChallengeProgram } from '../../core/types/challengeProgram';
import { resolveChallengeResponseVisibility } from '../../core/utils/challengeVisibility';
import {
  buildChallengeStampSlots,
  compareChallengeItems,
  getChallengeStampProgress,
} from '../../core/utils/challengeStampProgress';
import {
  ChallengeItemCard,
  type ChallengeItemDraft,
} from './ChallengeItemCard';
import { ChallengeProgressSummary } from './ChallengeStampCard';
import styles from './ChallengeScreen.module.css';

export type ChallengeScreenPreviewProps = {
  program: ChallengeProgram;
  items: ChallengeItem[];
};

/**
 * Read-only participant detail view for admin Preview.
 * Reuses ChallengeItemCard / stamp summary; never calls response/reward/peer APIs.
 */
export function ChallengeScreenPreview({
  program,
  items,
}: ChallengeScreenPreviewProps) {
  const sortedItems = useMemo(
    () => [...items].sort(compareChallengeItems),
    [items],
  );
  const [drafts, setDrafts] = useState<Record<string, ChallengeItemDraft>>({});
  const [activeItemId, setActiveItemId] = useState<string | null>(
    () => sortedItems[0]?.id ?? null,
  );

  const stampSlots = useMemo(
    () => buildChallengeStampSlots(sortedItems, [], []),
    [sortedItems],
  );
  const stampProgress = getChallengeStampProgress(stampSlots);

  return (
    <div className={styles.container} data-testid="challenge-screen-preview">
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <p className={styles.previewBadge} aria-label="プレビュー表示">
            参加者プレビュー
          </p>
          <h1 className={styles.title}>{program.title}</h1>
          {program.description ? (
            <p className={styles.subtitle}>{program.description}</p>
          ) : null}
        </div>
      </div>

      {!stampProgress.isComplete ? (
        <ChallengeProgressSummary slots={stampSlots} />
      ) : null}

      {sortedItems.length === 0 ? (
        <div className={styles.detailEmpty}>
          この挑戦状には、まだ質問がありません
        </div>
      ) : (
        <ul className={styles.itemList}>
          {sortedItems.map((item, index) => {
            const draft = drafts[item.id] ?? { comment: '' };
            const resolvedVisibility = resolveChallengeResponseVisibility({
              itemResponseVisibility: item.responseVisibility,
              programDefaultResponseVisibility:
                program.defaultResponseVisibility,
            });
            return (
              <ChallengeItemCard
                key={item.id}
                item={item}
                index={index + 1}
                existing={undefined}
                draft={draft}
                resolvedVisibility={resolvedVisibility}
                saving={false}
                expanded={activeItemId === item.id}
                emphasized={activeItemId === item.id}
                panelId={`challenge-preview-panel-${item.id}`}
                preview
                showManageActions={false}
                onExpand={() => setActiveItemId(item.id)}
                onCollapse={() => setActiveItemId(null)}
                onDraftChange={(next) =>
                  setDrafts((prev) => ({ ...prev, [item.id]: next }))
                }
                onSave={() => undefined}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
