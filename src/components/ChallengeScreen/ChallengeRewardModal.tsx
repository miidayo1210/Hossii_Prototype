import { useEffect, useId, useRef } from 'react';
import { getChallengeHossiiImageUrl, isChallengeHossiiKey } from '../../core/assets/challengeHossiiKeys';
import type { ChallengeRewardCelebrationKind } from '../../core/utils/challengeStampProgress';
import styles from './ChallengeRewardModal.module.css';

export type ChallengeRewardModalModel = {
  hossiiKey: string;
  itemTitle: string;
  kind: ChallengeRewardCelebrationKind;
  progressLabel: string;
  optionalLeftoverLabel: string | null;
  nextFocusItemId: string | null;
};

type Props = {
  model: ChallengeRewardModalModel;
  onPrimary: () => void;
  onSecondary: () => void;
  onDismiss: () => void;
};

function copyForKind(kind: ChallengeRewardCelebrationKind): {
  title: string;
  lead: string;
  primary: string;
  secondary: string;
} {
  switch (kind) {
    case 'clear_optional':
      return {
        title: '挑戦状クリア！',
        lead: '必要な挑戦をすべて達成しました',
        primary: 'おまけに挑戦する',
        secondary: '一覧へ戻る',
      };
    case 'complete':
      return {
        title: '挑戦状コンプリート！',
        lead: 'すべてのHossiiを集めました',
        primary: '回答を振り返る',
        secondary: '一覧へ戻る',
      };
    default:
      return {
        title: 'Hossiiをゲット！',
        lead: '回答ありがとう。次の挑戦も待っているよ',
        primary: 'つづける',
        secondary: 'いったん戻る',
      };
  }
}

export function ChallengeRewardModal({
  model,
  onPrimary,
  onSecondary,
  onDismiss,
}: Props) {
  const titleId = useId();
  const descId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(true);
  const copy = copyForKind(model.kind);
  const resolvedKey = isChallengeHossiiKey(model.hossiiKey) ? model.hossiiKey : null;
  const itemTitle = model.itemTitle.trim() || 'この挑戦';

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    primaryRef.current?.focus();

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
    <div className={styles.overlay}>
      <div
        ref={cardRef}
        className={`${styles.card} ${
          model.kind === 'continue' ? '' : styles.cardCelebration
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <button
          type="button"
          className={styles.closeIcon}
          aria-label="閉じる"
          onClick={() => runAndSkipRestore(onDismiss)}
        >
          ×
        </button>

        <div className={styles.glow} aria-hidden="true" />

        <div className={styles.imageWrap}>
          {resolvedKey ? (
            <img
              className={styles.image}
              src={getChallengeHossiiImageUrl(resolvedKey)}
              alt={`獲得したHossii（${itemTitle}）`}
            />
          ) : (
            <div className={styles.imageFallback} role="img" aria-label="獲得したHossii">
              Hossii
            </div>
          )}
        </div>

        <h2 id={titleId} className={styles.title}>
          {copy.title}
        </h2>
        <p id={descId} className={styles.lead}>
          {copy.lead}
        </p>
        <p className={styles.itemTitle}>「{itemTitle}」</p>
        <p className={styles.progress} aria-live="polite">
          {model.progressLabel}
        </p>
        {model.optionalLeftoverLabel ? (
          <p className={styles.optional}>{model.optionalLeftoverLabel}</p>
        ) : null}

        <div className={styles.actions}>
          <button
            ref={primaryRef}
            type="button"
            className={styles.primaryButton}
            onClick={() => runAndSkipRestore(onPrimary)}
          >
            {copy.primary}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => runAndSkipRestore(onSecondary)}
          >
            {copy.secondary}
          </button>
        </div>
      </div>
    </div>
  );
}
