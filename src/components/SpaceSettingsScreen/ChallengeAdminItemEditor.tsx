import { useId, useState } from 'react';
import type { ChallengeItemType } from '../../core/types/challengeProgram';
import { CHALLENGE_TITLE_MAX_LENGTH } from '../../core/types/challengeProgram';
import { CHALLENGE_ITEM_BODY_MAX_LENGTH } from '../../core/utils/challengeAdminDisplay';
import styles from './ChallengeAdminItemEditor.module.css';

export type ChallengeAdminItemFormState = {
  itemType: ChallengeItemType;
  title: string;
  description: string;
  reason: string;
  isRequired: boolean;
};

type Props = {
  mode: 'create' | 'edit';
  value: ChallengeAdminItemFormState;
  busy: boolean;
  error: string | null;
  onChange: (next: ChallengeAdminItemFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

function typeCopy(itemType: ChallengeItemType): { title: string; body: string; placeholder: string } {
  if (itemType === 'mission') {
    return {
      title: 'ミッション',
      body: '行動したことや、できたことを報告してもらう項目です',
      placeholder: '例：誰か一人に声をかけてみよう',
    };
  }
  return {
    title: '質問',
    body: '考えたことや気づきを、コメントで書いてもらう項目です',
    placeholder: '例：今日、印象に残ったことは？',
  };
}

export function ChallengeAdminItemEditor({
  mode,
  value,
  busy,
  error,
  onChange,
  onSubmit,
  onCancel,
}: Props) {
  const titleId = useId();
  const errorId = useId();
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(value.description.trim() || value.reason.trim()),
  );
  const copy = typeCopy(value.itemType);

  return (
    <div className={styles.editor} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.editorTitle}>
        {mode === 'edit' ? '項目を編集' : '項目の内容を入力'}
      </h3>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>種類</legend>
        <div className={styles.typeGrid}>
          <label
            className={`${styles.choiceCard} ${
              value.itemType === 'question' ? styles.choiceCardSelected : ''
            }`}
          >
            <input
              type="radio"
              name={`item-type-${titleId}`}
              checked={value.itemType === 'question'}
              disabled={busy}
              onChange={() => onChange({ ...value, itemType: 'question' })}
            />
            <span className={styles.choiceTitle}>質問</span>
            <span className={styles.choiceBody}>
              考えたことや気づきを、コメントで書いてもらう項目です
            </span>
          </label>
          <label
            className={`${styles.choiceCard} ${
              value.itemType === 'mission' ? styles.choiceCardSelected : ''
            }`}
          >
            <input
              type="radio"
              name={`item-type-${titleId}`}
              checked={value.itemType === 'mission'}
              disabled={busy}
              onChange={() => onChange({ ...value, itemType: 'mission' })}
            />
            <span className={styles.choiceTitle}>ミッション</span>
            <span className={styles.choiceBody}>
              行動したことや、できたことを報告してもらう項目です
            </span>
          </label>
        </div>
      </fieldset>

      <div className={styles.label}>
        <label htmlFor={`${titleId}-title`}>参加者に表示する問い・ミッション</label>
        <input
          id={`${titleId}-title`}
          className={styles.input}
          value={value.title}
          maxLength={CHALLENGE_TITLE_MAX_LENGTH}
          placeholder={copy.placeholder}
          disabled={busy}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
        />
        <span className={styles.counter}>
          {value.title.length} / {CHALLENGE_TITLE_MAX_LENGTH}
        </span>
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>クリア条件</legend>
        <div className={styles.typeGrid}>
          <label
            className={`${styles.choiceCard} ${
              value.isRequired ? styles.choiceCardSelected : ''
            }`}
          >
            <input
              type="radio"
              name={`item-required-${titleId}`}
              checked={value.isRequired}
              disabled={busy}
              onChange={() => onChange({ ...value, isRequired: true })}
            />
            <span className={styles.choiceTitle}>クリアに必要</span>
            <span className={styles.choiceBody}>
              この項目を達成すると、挑戦状のクリア条件に含まれます
            </span>
          </label>
          <label
            className={`${styles.choiceCard} ${
              !value.isRequired ? styles.choiceCardSelected : ''
            }`}
          >
            <input
              type="radio"
              name={`item-required-${titleId}`}
              checked={!value.isRequired}
              disabled={busy}
              onChange={() => onChange({ ...value, isRequired: false })}
            />
            <span className={styles.choiceTitle}>おまけ</span>
            <span className={styles.choiceBody}>
              クリアには必要ありません。追加のHossiiを集められます
            </span>
          </label>
        </div>
      </fieldset>

      <p className={styles.responseMethod}>回答方法：コメント</p>

      <div className={styles.preview} aria-label="参加者への表示イメージ">
        <p className={styles.previewLabel}>参加者への表示イメージ</p>
        <p className={styles.previewType}>{copy.title}</p>
        <p className={styles.previewTitle}>
          {value.title.trim() || copy.placeholder}
        </p>
        <p className={styles.previewMeta}>
          {value.isRequired ? 'クリアに必要' : 'おまけ'} ／ コメントで回答
        </p>
      </div>

      <button
        type="button"
        className={styles.detailsToggle}
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((open) => !open)}
      >
        {detailsOpen ? '詳細設定を閉じる' : '詳細設定'}
      </button>

      {detailsOpen && (
        <div className={styles.detailsPanel}>
          <label className={styles.label} htmlFor={`${titleId}-description`}>
            補足説明（任意）
            <span className={styles.help}>
              回答するときに伝えておきたい背景やヒントを書けます
            </span>
            <textarea
              id={`${titleId}-description`}
              className={styles.textarea}
              value={value.description}
              maxLength={CHALLENGE_ITEM_BODY_MAX_LENGTH}
              rows={3}
              disabled={busy}
              onChange={(event) =>
                onChange({ ...value, description: event.target.value })
              }
            />
            <span className={styles.counter}>
              {value.description.length} / {CHALLENGE_ITEM_BODY_MAX_LENGTH}
            </span>
          </label>
          <label className={styles.label} htmlFor={`${titleId}-reason`}>
            この挑戦のねらい（任意）
            <span className={styles.help}>
              なぜこの質問やミッションに取り組むのかを伝えます（参加者画面に表示されます）
            </span>
            <textarea
              id={`${titleId}-reason`}
              className={styles.textarea}
              value={value.reason}
              maxLength={CHALLENGE_ITEM_BODY_MAX_LENGTH}
              rows={2}
              disabled={busy}
              onChange={(event) => onChange({ ...value, reason: event.target.value })}
            />
            <span className={styles.counter}>
              {value.reason.length} / {CHALLENGE_ITEM_BODY_MAX_LENGTH}
            </span>
          </label>
        </div>
      )}

      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onSubmit}
          disabled={busy || !value.title.trim()}
        >
          {busy
            ? '保存しています…'
            : mode === 'edit'
              ? '変更を保存'
              : 'この項目を追加'}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onCancel}
          disabled={busy}
        >
          入力をやめる
        </button>
      </div>
    </div>
  );
}
