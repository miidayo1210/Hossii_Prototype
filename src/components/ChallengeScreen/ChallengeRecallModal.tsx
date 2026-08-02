import { useEffect, useId, useRef } from 'react';
import { getChallengeHossiiImageUrl, isChallengeHossiiKey } from '../../core/assets/challengeHossiiKeys';
import type { ChallengeItem } from '../../core/types/challengeProgram';
import type { ChallengeResponse } from '../../core/types/challengeResponse';
import type { ChallengeCompletion, ChallengeReward } from '../../core/types/challengeReward';
import { challengeResponseVisibilityLabel } from '../../core/utils/challengeVisibility';
import { ChallengeResponseActionMenu } from './ChallengeResponseActionMenu';
import styles from './ChallengeRecallModal.module.css';

export type ChallengeRecallModalModel = {
  item: ChallengeItem;
  response: ChallengeResponse | null;
  completion: ChallengeCompletion;
  reward: ChallengeReward | null;
};

type Props = {
  model: ChallengeRecallModalModel;
  onRewrite: () => void;
  onAnswerAgain: () => void;
  onDelete?: () => Promise<void> | void;
  onDismiss: () => void;
};

function formatAwardedAt(date: Date): string {
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return '';
  }
}

export function ChallengeRecallModal({
  model,
  onRewrite,
  onAnswerAgain,
  onDelete,
  onDismiss,
}: Props) {
  const titleId = useId();
  const descId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(true);

  const itemTitle = model.item.title.trim() || 'この挑戦';
  const typeLabel = model.item.itemType === 'question' ? '質問' : 'ミッション';
  const requiredLabel = model.item.isRequired ? 'クリアに必要' : 'おまけ';
  const hasResponse = Boolean(model.response);
  const hossiiKey =
    model.reward && isChallengeHossiiKey(model.reward.hossiiKey)
      ? model.reward.hossiiKey
      : null;
  const awardedLabel = formatAwardedAt(
    model.reward?.awardedAt ?? model.completion.completedAt,
  );

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (restoreFocusRef.current) {
        previousFocusRef.current?.focus();
      }
    };
  }, []);

  const runAndSkipRestore = (action: () => void) => {
    restoreFocusRef.current = false;
    action();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        restoreFocusRef.current = false;
        onDismiss();
        return;
      }
      if (event.key !== 'Tab' || !cardRef.current) return;
      const focusable = cardRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !cardRef.current.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  return (
    <div
      className={styles.overlay}
      onMouseDown={() => runAndSkipRestore(onDismiss)}
    >
      <div
        ref={cardRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.topBar}>
          <div className={styles.topBarSpacer} />
          <div className={styles.topActions}>
            {hasResponse && onDelete ? (
              <div className={styles.menuWrap}>
                <ChallengeResponseActionMenu
                  itemTitle={itemTitle}
                  onRewrite={() => runAndSkipRestore(onRewrite)}
                  onDelete={async () => {
                    await onDelete();
                    runAndSkipRestore(onDismiss);
                  }}
                />
              </div>
            ) : !hasResponse ? (
              <div className={styles.menuWrap}>
                <ChallengeResponseActionMenu
                  itemTitle={itemTitle}
                  variant="answerAgain"
                  onRewrite={() => {}}
                  onDelete={() => {}}
                  onAnswerAgain={() => runAndSkipRestore(onAnswerAgain)}
                />
              </div>
            ) : null}
            <button
              ref={closeRef}
              type="button"
              className={styles.closeIcon}
              aria-label="閉じる"
              onClick={() => runAndSkipRestore(onDismiss)}
            >
              ×
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.imageWrap}>
            {hossiiKey ? (
              <img
                className={styles.image}
                src={getChallengeHossiiImageUrl(hossiiKey)}
                alt={`獲得したHossii（${itemTitle}）`}
              />
            ) : (
              <div
                className={styles.imageFallback}
                role="img"
                aria-label="獲得済みのスタンプ"
              >
                獲得済み
              </div>
            )}
          </div>

          <p className={styles.meta}>
            {typeLabel}・{requiredLabel}
            {awardedLabel ? `・${awardedLabel}` : ''}
          </p>
          <h2 id={titleId} className={styles.title}>
            {itemTitle}
          </h2>
          {model.item.description ? (
            <p id={descId} className={styles.description}>
              {model.item.description}
            </p>
          ) : (
            <p id={descId} className={styles.srOnly}>
              回答の記録
            </p>
          )}

          <div className={styles.answerBlock}>
            <p className={styles.answerLabel}>回答</p>
            {hasResponse && model.response ? (
              <>
                <p className={styles.answerBody}>
                  {model.response.comment || '（回答なし）'}
                </p>
                <p className={styles.visibility}>
                  {challengeResponseVisibilityLabel(model.response.visibility)}
                </p>
              </>
            ) : (
              <p className={styles.answerDeleted}>回答は削除済みです</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
