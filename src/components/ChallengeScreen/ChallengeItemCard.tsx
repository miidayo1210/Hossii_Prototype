import type { ReactNode } from 'react';
import type { ChallengeItem } from '../../core/types/challengeProgram';
import type {
  ChallengeResponse,
  ChallengeResponseVisibility,
} from '../../core/types/challengeResponse';
import { CHALLENGE_RESPONSE_COMMENT_MAX_LENGTH } from '../../core/types/challengeResponse';
import { ChallengeResponseActionMenu } from './ChallengeResponseActionMenu';
import styles from './ChallengeItemCard.module.css';

export type ChallengeItemDraft = {
  comment: string;
  visibility: ChallengeResponseVisibility;
};

type Props = {
  item: ChallengeItem;
  index: number;
  existing: ChallengeResponse | undefined;
  draft: ChallengeItemDraft;
  saving: boolean;
  expanded: boolean;
  emphasized: boolean;
  panelId: string;
  /** responseなしでも completion／reward があるとき */
  stampEarned?: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onDraftChange: (draft: ChallengeItemDraft) => void;
  onSave: () => void;
  onRewrite: () => void;
  onDelete: () => Promise<void> | void;
  /** 回答済み抜粋から回想Modalを開く */
  onRecall: () => void;
};

function visibilityHelp(visibility: ChallengeResponseVisibility): string {
  if (visibility === 'self_only') {
    return '「自分だけに残す」を選ぶと、この回答はあなただけが見られます。';
  }
  return '「管理者にだけ共有」を選ぶと、スペース管理者にもこの回答が見られます。';
}

function visibilityLabel(visibility: ChallengeResponseVisibility): string {
  return visibility === 'self_only' ? '自分だけに残す' : '管理者にだけ共有';
}

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

function VisibilitySelector({
  itemId,
  value,
  disabled,
  onChange,
}: {
  itemId: string;
  value: ChallengeResponseVisibility;
  disabled: boolean;
  onChange: (value: ChallengeResponseVisibility) => void;
}) {
  const helpId = `visibility-help-${itemId}`;
  return (
    <fieldset className={styles.visibilityFieldset} disabled={disabled}>
      <legend className={styles.visibilityLegend}>公開範囲</legend>
      <div className={styles.radioRow}>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            name={`visibility-${itemId}`}
            value="manager_only"
            checked={value === 'manager_only'}
            onChange={() => onChange('manager_only')}
          />
          管理者にだけ共有
        </label>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            name={`visibility-${itemId}`}
            value="self_only"
            checked={value === 'self_only'}
            onChange={() => onChange('self_only')}
          />
          自分だけに残す
        </label>
      </div>
      <p id={helpId} className={styles.visibilityHelp}>
        {visibilityHelp(value)}
      </p>
    </fieldset>
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
  saving,
  stampEarned,
  onDraftChange,
  onSave,
}: {
  item: ChallengeItem;
  draft: ChallengeItemDraft;
  existing: ChallengeResponse | undefined;
  saving: boolean;
  stampEarned?: boolean;
  onDraftChange: (draft: ChallengeItemDraft) => void;
  onSave: () => void;
}) {
  return (
    <div className={styles.responseSlot}>
      {item.reason ? (
        <p className={styles.reason}>なぜ取り組むのか：{item.reason}</p>
      ) : null}
      {existing ? (
        <p className={styles.existingAnswer} aria-live="polite">
          保存済み（{visibilityLabel(existing.visibility)}）
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
      <VisibilitySelector
        itemId={item.id}
        value={draft.visibility}
        disabled={saving}
        onChange={(visibility) => onDraftChange({ ...draft, visibility })}
      />
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
  saving,
  expanded,
  emphasized,
  panelId,
  stampEarned,
  onExpand,
  onCollapse,
  onDraftChange,
  onSave,
  onRewrite,
  onDelete,
  onRecall,
}: Props) {
  const answered = Boolean(existing);
  const actionMenu = answered ? (
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
            >
              <span className={styles.excerptText}>
                {formatExcerpt(existing.comment)}
              </span>
            </button>
            <p className={styles.compactVisibility}>
              {visibilityLabel(existing.visibility)}
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
          saving={saving}
          stampEarned={stampEarned}
          onDraftChange={onDraftChange}
          onSave={onSave}
        />
      </div>
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
