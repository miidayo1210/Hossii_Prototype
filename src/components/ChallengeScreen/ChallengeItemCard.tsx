import type { ReactNode } from 'react';
import type { ChallengeItem } from '../../core/types/challengeProgram';
import type {
  ChallengeResponse,
  ChallengeResponseVisibility,
} from '../../core/types/challengeResponse';
import { CHALLENGE_RESPONSE_COMMENT_MAX_LENGTH } from '../../core/types/challengeResponse';
import {
  CHALLENGE_COMPLETE_BUTTON_LABEL,
} from '../../core/utils/challengeCompleteButton';
import {
  findChallengeChoice3OptionIndex,
  parseChallengeChoice3Options,
} from '../../core/utils/challengeChoice3';
import {
  challengeResponseVisibilityLabel,
  challengeResponseVisibilityParticipantExplanation,
} from '../../core/utils/challengeVisibility';
import { ChallengeResponseActionMenu } from './ChallengeResponseActionMenu';
import { ChallengePhotoImage } from './ChallengePhotoImage';
import { ChallengeSpaceMembersAnswers } from './ChallengeSpaceMembersAnswers';
import styles from './ChallengeItemCard.module.css';

export type ChallengeItemDraft = {
  comment: string;
  /** Local file selected for photo answer (not yet uploaded). */
  photoFile?: File | null;
  /** Object URL for local photo preview; revoke when clearing. */
  photoPreviewUrl?: string | null;
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

function Choice3ResponseSlot({
  itemId,
  options,
  selectedLabel,
  disabled,
  onSelect,
}: {
  itemId: string;
  options: readonly string[];
  selectedLabel: string;
  disabled: boolean;
  onSelect: (label: string) => void;
}) {
  const selectedIndex = findChallengeChoice3OptionIndex(options, selectedLabel);
  return (
    <fieldset className={styles.choiceFieldset}>
      <legend className={styles.choiceLegend}>選択肢から1つ選ぶ</legend>
      <div className={styles.choiceList} role="radiogroup" aria-label="回答の選択肢">
        {options.map((option, index) => {
          const inputId = `choice3-${itemId}-${index}`;
          const checked = selectedIndex === index;
          return (
            <label
              key={inputId}
              className={`${styles.choiceOption} ${
                checked ? styles.choiceOptionSelected : ''
              }`}
              htmlFor={inputId}
            >
              <input
                id={inputId}
                type="radio"
                name={`choice3-${itemId}`}
                checked={checked}
                disabled={disabled}
                onChange={() => onSelect(option)}
              />
              <span className={styles.choiceOptionLabel}>{option}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function PhotoResponseSlot({
  itemId,
  draft,
  existing,
  disabled,
  onDraftChange,
}: {
  itemId: string;
  draft: ChallengeItemDraft;
  existing: ChallengeResponse | undefined;
  disabled: boolean;
  onDraftChange: (draft: ChallengeItemDraft) => void;
}) {
  const inputId = `challenge-photo-${itemId}`;
  const hasLocal = Boolean(draft.photoFile && draft.photoPreviewUrl);
  const savedPath = existing?.photoPath?.trim() || '';

  return (
    <div className={styles.photoSlot}>
      {hasLocal ? (
        <img
          src={draft.photoPreviewUrl!}
          alt="選択中の写真プレビュー"
          className={styles.photoPreview}
        />
      ) : savedPath ? (
        <ChallengePhotoImage photoPath={savedPath} size="md" alt="保存済みの回答写真" />
      ) : (
        <p className={styles.note}>写真を1枚選んでください</p>
      )}
      <label className={styles.photoPickerLabel} htmlFor={inputId}>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className={styles.photoInput}
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            if (draft.photoPreviewUrl) {
              URL.revokeObjectURL(draft.photoPreviewUrl);
            }
            onDraftChange({
              ...draft,
              photoFile: file,
              photoPreviewUrl: URL.createObjectURL(file),
            });
          }}
        />
        {hasLocal || savedPath ? '写真を差し替える' : '写真を選ぶ'}
      </label>
    </div>
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

  if (item.responseType === 'complete_button') {
    return (
      <div className={styles.responseSlot}>
        {item.reason ? (
          <p className={styles.reason}>なぜ取り組むのか：{item.reason}</p>
        ) : null}
        {existing ? (
          <p className={styles.existingAnswer} aria-live="polite">
            完了済み（{challengeResponseVisibilityLabel(existing.visibility)}）
            {'\n'}
            {existing.comment}
          </p>
        ) : (
          <>
            {stampEarned ? (
              <p className={styles.stampEarnedNote}>スタンプ獲得済み</p>
            ) : null}
            <VisibilityNotice visibility={visibility} />
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.saveButton}
                disabled={saving}
                aria-label={`${item.title}を完了する`}
                onClick={onSave}
              >
                {saving ? '完了中…' : CHALLENGE_COMPLETE_BUTTON_LABEL}
              </button>
            </div>
          </>
        )}
        {existing ? <VisibilityNotice visibility={visibility} /> : null}
      </div>
    );
  }

  if (item.responseType === 'choice3') {
    const options = parseChallengeChoice3Options(item.responseConfig);
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
        {options ? (
          <Choice3ResponseSlot
            itemId={item.id}
            options={options}
            selectedLabel={draft.comment}
            disabled={saving}
            onSelect={(comment) => onDraftChange({ ...draft, comment })}
          />
        ) : (
          <p className={styles.note}>選択肢を読み込めませんでした。</p>
        )}
        <VisibilityNotice visibility={visibility} />
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.saveButton}
            disabled={
              saving ||
              !options ||
              findChallengeChoice3OptionIndex(options, draft.comment) < 0
            }
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

  if (item.responseType === 'photo') {
    return (
      <div className={styles.responseSlot}>
        {item.reason ? (
          <p className={styles.reason}>なぜ取り組むのか：{item.reason}</p>
        ) : null}
        {existing ? (
          <p className={styles.existingAnswer} aria-live="polite">
            保存済み（{challengeResponseVisibilityLabel(existing.visibility)}）
          </p>
        ) : null}
        {!existing && stampEarned ? (
          <p className={styles.stampEarnedNote}>スタンプ獲得済み</p>
        ) : null}
        <PhotoResponseSlot
          itemId={item.id}
          draft={draft}
          existing={existing}
          disabled={saving}
          onDraftChange={onDraftChange}
        />
        <VisibilityNotice visibility={visibility} />
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.saveButton}
            disabled={saving || !draft.photoFile}
            aria-label={
              existing
                ? `${item.title}の写真を更新`
                : `${item.title}の写真を保存`
            }
            onClick={onSave}
          >
            {saving ? '保存中…' : existing ? '写真を更新' : '写真を保存'}
          </button>
        </div>
      </div>
    );
  }

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
          disabled={
            saving ||
            item.responseType !== 'comment' ||
            !draft.comment.trim()
          }
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
  const isCompleteButton = item.responseType === 'complete_button';
  const peerAnswers = (
    <ChallengeSpaceMembersAnswers
      answers={spaceMemberAnswers}
      currentUserId={currentUserId}
      responderNames={responderNames}
    />
  );
  const actionMenu =
    answered && showManageActions && onDelete ? (
      isCompleteButton ? (
        <ChallengeResponseActionMenu
          itemTitle={item.title}
          disabled={saving}
          variant="deleteOnly"
          onRewrite={() => undefined}
          onDelete={onDelete}
        />
      ) : onRewrite ? (
        <ChallengeResponseActionMenu
          itemTitle={item.title}
          disabled={saving}
          onRewrite={onRewrite}
          onDelete={onDelete}
        />
      ) : null
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
              {item.responseType === 'photo' && existing.photoPath ? (
                <span className={styles.excerptPhoto}>
                  <ChallengePhotoImage
                    photoPath={existing.photoPath}
                    size="sm"
                    alt="回答写真"
                  />
                </span>
              ) : (
                <span className={styles.excerptText}>
                  {formatExcerpt(existing.comment)}
                </span>
              )}
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
              {isCompleteButton ? CHALLENGE_COMPLETE_BUTTON_LABEL : 'この質問に答える'}
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
