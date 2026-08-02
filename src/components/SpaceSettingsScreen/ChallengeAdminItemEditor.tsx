import { useId, useState } from 'react';
import type {
  ChallengeItemType,
  ChallengeResponseType,
} from '../../core/types/challengeProgram';
import {
  CHALLENGE_ADMIN_SELECTABLE_RESPONSE_TYPES,
  CHALLENGE_TITLE_MAX_LENGTH,
} from '../../core/types/challengeProgram';
import {
  CHALLENGE_RESPONSE_VISIBILITIES,
  type ChallengeResponseVisibility,
} from '../../core/types/challengeResponse';
import { CHALLENGE_ITEM_BODY_MAX_LENGTH } from '../../core/utils/challengeAdminDisplay';
import {
  CHALLENGE_CHOICE3_OPTION_COUNT,
  CHALLENGE_CHOICE3_OPTION_MAX_LENGTH,
  emptyChallengeChoice3Options,
  type ChallengeChoice3Options,
} from '../../core/utils/challengeChoice3';
import {
  challengeResponseVisibilityHelp,
  challengeResponseVisibilityLabel,
  resolveChallengeResponseVisibility,
} from '../../core/utils/challengeVisibility';
import styles from './ChallengeAdminItemEditor.module.css';

export type ChallengeAdminItemFormState = {
  itemType: ChallengeItemType;
  title: string;
  description: string;
  reason: string;
  isRequired: boolean;
  responseType: ChallengeResponseType;
  /** null = inherit program default */
  responseVisibility: ChallengeResponseVisibility | null;
  /** choice3 labels (exactly 3 slots in the form). */
  choiceOptions: ChallengeChoice3Options;
};

function responseTypeLabel(responseType: ChallengeResponseType): string {
  if (responseType === 'complete_button') return '完了ボタン';
  if (responseType === 'comment') return 'コメント';
  if (responseType === 'choice3') return '3択';
  if (responseType === 'photo') return '写真';
  return 'コメント';
}

function responseTypeHelp(responseType: ChallengeResponseType): string {
  if (responseType === 'complete_button') {
    return '参加者が「完了する」を押すだけで達成します';
  }
  if (responseType === 'choice3') {
    return '参加者が3つの選択肢から1つ選んで回答します';
  }
  if (responseType === 'photo') {
    return '参加者が写真1枚をアップロードして回答します';
  }
  return '参加者がコメントを書いて回答します';
}

type Props = {
  mode: 'create' | 'edit';
  value: ChallengeAdminItemFormState;
  programDefaultVisibility: ChallengeResponseVisibility;
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
  programDefaultVisibility,
  busy,
  error,
  onChange,
  onSubmit,
  onCancel,
}: Props) {
  const titleId = useId();
  const errorId = useId();
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(
      value.description.trim() ||
        value.reason.trim() ||
        value.responseVisibility != null,
    ),
  );
  const copy = typeCopy(value.itemType);
  const effectiveVisibility = resolveChallengeResponseVisibility({
    itemResponseVisibility: value.responseVisibility,
    programDefaultResponseVisibility: programDefaultVisibility,
  });
  const selectValue = value.responseVisibility ?? 'inherit';

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

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>回答形式</legend>
        <div className={styles.typeGrid}>
          {CHALLENGE_ADMIN_SELECTABLE_RESPONSE_TYPES.map((option) => (
            <label
              key={option}
              className={`${styles.choiceCard} ${
                value.responseType === option ? styles.choiceCardSelected : ''
              }`}
            >
              <input
                type="radio"
                name={`item-response-type-${titleId}`}
                checked={value.responseType === option}
                disabled={busy}
                onChange={() =>
                  onChange({
                    ...value,
                    responseType: option,
                    choiceOptions:
                      option === 'choice3' &&
                      value.choiceOptions.every((entry) => !entry.trim())
                        ? emptyChallengeChoice3Options()
                        : value.choiceOptions,
                  })
                }
              />
              <span className={styles.choiceTitle}>
                {responseTypeLabel(option)}
              </span>
              <span className={styles.choiceBody}>
                {responseTypeHelp(option)}
              </span>
            </label>
          ))}
        </div>
        {value.responseType === 'photo' ? (
          <p className={styles.help}>
            MVPは写真1枚です。任意コメントはありません。EXIFは端末側の再圧縮で除去します。
          </p>
        ) : null}
      </fieldset>

      {value.responseType === 'choice3' ? (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>選択肢（3つ）</legend>
          <p className={styles.help}>
            参加者が選ぶ文言です。回答時にこのラベルがそのまま保存されます。
          </p>
          {Array.from({ length: CHALLENGE_CHOICE3_OPTION_COUNT }, (_, index) => (
            <div key={`choice-option-${index}`} className={styles.label}>
              <label htmlFor={`${titleId}-option-${index}`}>
                選択肢{index + 1}
              </label>
              <input
                id={`${titleId}-option-${index}`}
                className={styles.input}
                value={value.choiceOptions[index] ?? ''}
                maxLength={CHALLENGE_CHOICE3_OPTION_MAX_LENGTH}
                placeholder={`例：選択肢${index + 1}`}
                disabled={busy}
                onChange={(event) => {
                  const next = [...value.choiceOptions] as ChallengeChoice3Options;
                  next[index] = event.target.value;
                  onChange({ ...value, choiceOptions: next });
                }}
              />
              <span className={styles.counter}>
                {(value.choiceOptions[index] ?? '').length} /{' '}
                {CHALLENGE_CHOICE3_OPTION_MAX_LENGTH}
              </span>
            </div>
          ))}
        </fieldset>
      ) : null}

      <div className={styles.preview} aria-label="参加者への表示イメージ">
        <p className={styles.previewLabel}>参加者への表示イメージ</p>
        <p className={styles.previewType}>{copy.title}</p>
        <p className={styles.previewTitle}>
          {value.title.trim() || copy.placeholder}
        </p>
        <p className={styles.previewMeta}>
          {value.isRequired ? 'クリアに必要' : 'おまけ'} ／{' '}
          {responseTypeLabel(value.responseType)}で回答 ／{' '}
          {challengeResponseVisibilityLabel(effectiveVisibility)}
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
          <label className={styles.label} htmlFor={`${titleId}-visibility`}>
            公開範囲（任意）
            <span className={styles.help}>
              未設定のときは挑戦状の標準公開範囲（
              {challengeResponseVisibilityLabel(programDefaultVisibility)}
              ）を使います
            </span>
            <select
              id={`${titleId}-visibility`}
              className={styles.input}
              value={selectValue}
              disabled={busy}
              aria-describedby={`${titleId}-visibility-help`}
              onChange={(event) => {
                const next = event.target.value;
                onChange({
                  ...value,
                  responseVisibility:
                    next === 'inherit'
                      ? null
                      : (next as ChallengeResponseVisibility),
                });
              }}
            >
              <option value="inherit">
                挑戦状の標準を使う（
                {challengeResponseVisibilityLabel(programDefaultVisibility)}）
              </option>
              {CHALLENGE_RESPONSE_VISIBILITIES.map((option) => (
                <option key={option} value={option}>
                  {challengeResponseVisibilityLabel(option)}
                </option>
              ))}
            </select>
            <span id={`${titleId}-visibility-help`} className={styles.help}>
              {challengeResponseVisibilityHelp(effectiveVisibility)}
            </span>
          </label>
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
