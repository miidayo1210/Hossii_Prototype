import { useId } from 'react';
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
import {
  CHALLENGE_ITEM_BODY_MAX_LENGTH,
  challengeItemTypeHelp,
  challengeItemTypeLabel,
  challengeResponseTypeAdminHelp,
  challengeResponseTypeLabel,
} from '../../core/utils/challengeAdminDisplay';
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

function titlePlaceholder(itemType: ChallengeItemType): string {
  return itemType === 'mission'
    ? '例：誰か一人に声をかけてみよう'
    : '例：今日、印象に残ったことは？';
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
  const typeLabel = challengeItemTypeLabel(value.itemType);
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

      <div className={styles.lockedType} aria-label={`種類：${typeLabel}`}>
        <span className={styles.lockedTypeBadge}>{typeLabel}</span>
        <p className={styles.lockedTypeHelp}>
          {challengeItemTypeHelp(value.itemType)}
        </p>
        <p className={styles.help}>
          種類は「質問を追加／ミッションを追加」で決まります。ここでは変更できません。
        </p>
      </div>

      <div className={styles.label}>
        <label htmlFor={`${titleId}-title`}>参加者に表示する問い・ミッション</label>
        <input
          id={`${titleId}-title`}
          className={styles.input}
          value={value.title}
          maxLength={CHALLENGE_TITLE_MAX_LENGTH}
          placeholder={titlePlaceholder(value.itemType)}
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
                {challengeResponseTypeLabel(option)}
              </span>
              <span className={styles.choiceBody}>
                {challengeResponseTypeAdminHelp(option)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {value.responseType === 'comment' ? (
        <p className={styles.responseHint}>
          {challengeResponseTypeAdminHelp('comment')}
        </p>
      ) : null}

      {value.responseType === 'complete_button' ? (
        <p className={styles.responseHint}>
          {challengeResponseTypeAdminHelp('complete_button')}
        </p>
      ) : null}

      {value.responseType === 'photo' ? (
        <p className={styles.responseHint}>
          写真は1枚です。コメント欄はありません。EXIFは端末側の再圧縮で除去します。
        </p>
      ) : null}

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
          なぜこの項目に取り組むのかを伝えます（参加者画面に表示されます）
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
