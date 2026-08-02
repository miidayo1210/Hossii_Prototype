import type { ReactNode } from 'react';
import type { ChallengeItem } from '../../core/types/challengeProgram';
import type {
  ChallengeResponse,
  ChallengeResponseVisibility,
} from '../../core/types/challengeResponse';
import { CHALLENGE_RESPONSE_COMMENT_MAX_LENGTH } from '../../core/types/challengeResponse';
import {
  challengeResponseVisibilityLabel,
  challengeResponseVisibilityParticipantExplanation,
} from '../../core/utils/challengeVisibility';
import { ChallengeResponseActionMenu } from './ChallengeResponseActionMenu';
import { ChallengeSpaceMembersAnswers } from './ChallengeSpaceMembersAnswers';
import styles from './ChallengeItemCard.module.css';

export type ChallengeItemDraft = {
  comment: string;
};

type Props = {
  item: ChallengeItem;
  index: number;
  existing: ChallengeResponse | undefined;
  draft: ChallengeItemDraft;
  /** Effective setting for new answers (item override → program default). */
  resolvedVisibility: ChallengeResponseVisibility;
  saving: boolean;
  expanded: boolean;
  emphasized: boolean;
  panelId: string;
  /** responseなしでも completion／reward があるとき */
  stampEarned?: boolean;
  /** Peer-visible space_members answers for this item (RLS-filtered). */
  spaceMemberAnswers?: ChallengeResponse[];
  currentUserId?: string | null;
  responderNames?: Readonly<Record<string, string>>;
  onExpand: () => void;
  onCollapse: () => void;
  onDraftChange: (draft: ChallengeItemDraft) => void;
  onSave: () => void;
  onRewrite?: () => void;
  onDelete?: () => Promise<void> | void;
  /** 回答済み抜粋から回想Modalを開く */
  onRecall?: () => void;
  /** 詳細では記録Modal側に寄せるため false 可 */
  showManageActions?: boolean;
};

function formatExcerpt(comment: string | null | undefined): string {
  const text = (comment ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '（回答なし）';
  return text;
}

function ItemHeader({
  item,
  index,
  answered,
  actions,
}: {
  item: ChallengeItem;
  index: number;
  answered: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.headerBar}>
      <div className={styles.headerRow}>
        <span className={styles.index} aria-hidden="true">
          {index}
        </span>
        <span
          className={`${styles.statusBadge} ${
            answered ? styles.statusAnswered : styles.statusPending
          }`}
        >
          {answered ? '回答済み' : '未回答'}
        </span>
        <span className={styles.metaBadge}>
          {item.itemType === 'question' ? '質問' : 'ミッション'}
        </span>
        <span className={styles.metaBadge}>
          {item.isRequired ? 'クリアに必要' : 'おまけ'}
        </span>
      </div>
      {actions}
    </div>
  );
}

function ItemDescription({
  item,
  compact,
}: {
  item: ChallengeItem;
  compact: boolean;
}) {
  if (!item.description) return null;
  return (
    <p className={compact ? styles.descriptionClamp : styles.description}>
      {item.description}
    </p>
  );
}

function VisibilityNotice({
  visibility,
}: {
  visibility: ChallengeResponseVisibility;
}) {
  return (
    <div className={styles.visibilityNotice} aria-live="polite">
      <p className={styles.visibilityLegend}>公開範囲</p>
      <p className={styles.visibilityHelp}>
        {challengeResponseVisibilityParticipantExplanation(visibility)}
      </p>
    </div>
  );
}

function CommentResponseSlot({
  itemId,
  value,
  disabled,
  onChange,
}: {
  itemId: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const inputId = `comment-${itemId}`;
  return (
    <label className={styles.label} htmlFor={inputId}>
      コメント回答
      <textarea
        id={inputId}
        className={styles.textarea}
        rows={4}
        maxLength={CHALLENGE_RESPONSE_COMMENT_MAX_LENGTH}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className={styles.charCount}>
        {value.trim().length} / {CHALLENGE_RESPONSE_COMMENT_MAX_LENGTH}
      </span>
    </label>
  );
}

function ResponseEditor({
  item,
  draft,
  existing,
  resolvedVisibility,
  saving,
  stampEarned,
  onDraftChange,
  onSave,
}: {
  item: ChallengeItem;
  draft: ChallengeItemDraft;
  existing: ChallengeResponse | undefined;
  resolvedVisibility: ChallengeResponseVisibility;
  saving: boolean;
  stampEarned?: boolean;
  onDraftChange: (draft: ChallengeItemDraft) => void;
  onSave: () => void;
}) {
  // Rewrite keeps the stamped snapshot; new answers show current settings.
  const visibility = existing?.visibility ?? resolvedVisibility;

  return (
    <div className={styles.responseSlot}>
      {item.reason ? (
        <p className={styles.reason}>なぜ取り組むのか：{item.reason}</p>
      ) : null}
      {existing ? (
        <p className={styles.existingAnswer} aria-live="polite">
          保存済み（{challengeResponseVisibilityLabel(existing.visibility)}）
          {'\n'}
          {existing.comment}
        </p>
      ) : null}
      {!existing && stampEarned ? (
        <p className={styles.stampEarnedNote}>スタンプ獲得済み</p>
      ) : null}
      {item.responseType === 'comment' ? (
        <CommentResponseSlot
          itemId={item.id}
          value={draft.comment}
          disabled={saving}
          onChange={(comment) => onDraftChange({ ...draft, comment })}
        />
      ) : (
        <p className={styles.note}>この回答形式にはまだ対応していません。</p>
      )}
      <VisibilityNotice visibility={visibility} />
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.saveButton}
          disabled={saving || !draft.comment.trim()}
          aria-label={
            existing
              ? `${item.title}の回答を更新`
              : `${item.title}の回答を保存`
          }
          onClick={onSave}
        >
          {saving ? '保存中…' : existing ? '回答を更新' : '回答を保存'}
        </button>
      </div>
    </div>
  );
}

export function ChallengeItemCard({
  item,
  index,
  existing,
  draft,
  resolvedVisibility,
  saving,
  expanded,
  emphasized,
  panelId,
  stampEarned,
  spaceMemberAnswers = [],
  currentUserId = null,
  responderNames = {},
  onExpand,
  onCollapse,
  onDraftChange,
  onSave,
  onRewrite,
  onDelete,
  onRecall,
  showManageActions = true,
}: Props) {
  const answered = Boolean(existing);
  const peerAnswers = (
    <ChallengeSpaceMembersAnswers
      answers={spaceMemberAnswers}
      currentUserId={currentUserId}
      responderNames={responderNames}
    />
  );
  const actionMenu =
    answered && showManageActions && onRewrite && onDelete ? (
      <ChallengeResponseActionMenu
        itemTitle={item.title}
        disabled={saving}
        onRewrite={onRewrite}
        onDelete={onDelete}
      />
    ) : null;

  if (!expanded) {
    return (
      <li
        className={`${styles.card} ${emphasized ? styles.cardEmphasized : ''}`}
      >
        <ItemHeader
          item={item}
          index={index}
          answered={answered}
          actions={actionMenu}
        />
        <h3 className={styles.title}>{item.title}</h3>
        <ItemDescription item={item} compact />
        {answered && existing ? (
          <>
            <button
              type="button"
              className={styles.excerptButton}
              aria-label={`「${item.title}」の回答を振り返る`}
              onClick={onRecall}
              disabled={!onRecall}
            >
              <span className={styles.excerptText}>
                {formatExcerpt(existing.comment)}
              </span>
            </button>
            <p className={styles.compactVisibility}>
              {challengeResponseVisibilityLabel(existing.visibility)}
            </p>
          </>
        ) : (
          <>
            {stampEarned ? (
              <p className={styles.stampEarnedNote}>スタンプ獲得済み</p>
            ) : null}
            <button
              type="button"
              className={styles.toggleButton}
              aria-expanded={false}
              aria-controls={panelId}
              onClick={onExpand}
            >
              この質問に答える
            </button>
          </>
        )}
        {peerAnswers}
      </li>
    );
  }

  return (
    <li
      className={`${styles.card} ${styles.cardExpanded} ${
        emphasized ? styles.cardEmphasized : ''
      }`}
    >
      <ItemHeader
        item={item}
        index={index}
        answered={answered}
        actions={actionMenu}
      />
      <h3 className={styles.title}>{item.title}</h3>
      <ItemDescription item={item} compact={false} />
      <div id={panelId}>
        <ResponseEditor
          item={item}
          draft={draft}
          existing={existing}
          resolvedVisibility={resolvedVisibility}
          saving={saving}
          stampEarned={stampEarned}
          onDraftChange={onDraftChange}
          onSave={onSave}
        />
      </div>
      {peerAnswers}
      {!emphasized ? (
        <button
          type="button"
          className={styles.collapseButton}
          aria-expanded={true}
          aria-controls={panelId}
          onClick={onCollapse}
        >
          閉じる
        </button>
      ) : null}
    </li>
  );
}
