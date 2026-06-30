import { useCallback, useState, type CSSProperties } from 'react';
import type { EmotionKey } from '../../../../../../../src/core/types';
import { EMOJI_BY_EMOTION } from '../../../../../../../src/core/assets/emotions';
import { EMOTION_COLORS } from '../../../../../../../src/core/assets/emotionColors';
import { EMOTION_PICKER_KEYS, EMOTION_PICKER_LABELS } from './emotionPickerConfig';
import styles from './EmotionPicker.module.css';

export type EmotionPickerProps = {
  /** 選択中の感情。未選択は null */
  value: EmotionKey | null;
  onChange: (emotion: EmotionKey | null) => void;
  /** 見出し。省略時は Hossii らしいデフォルト文言 */
  label?: string;
  /** 必須フィールドとして表示する */
  required?: boolean;
  /** 選択中のヒント行を表示する */
  showHint?: boolean;
  /** バリデーションエラー表示 */
  error?: boolean;
  errorMessage?: string;
  className?: string;
};

export function EmotionPicker({
  value,
  onChange,
  label = '気持ちを選ぶ',
  required = false,
  showHint = true,
  error = false,
  errorMessage = '気持ちを選んでください',
  className,
}: EmotionPickerProps) {
  const [popKey, setPopKey] = useState<EmotionKey | null>(null);

  const handleSelect = useCallback(
    (key: EmotionKey) => {
      const next = value === key ? null : key;
      onChange(next);
      if (next !== null) {
        setPopKey(key);
        window.setTimeout(() => setPopKey(null), 200);
      }
    },
    [onChange, value],
  );

  return (
    <section
      className={`${styles.root}${error ? ` ${styles.rootError}` : ''}${className ? ` ${className}` : ''}`}
      aria-labelledby="emotion-picker-label"
    >
      <div className={styles.labelRow}>
        <h3 id="emotion-picker-label" className={styles.label}>
          {label}
        </h3>
        {required && <span className={styles.requiredBadge}>必須</span>}
      </div>

      <div className={styles.glassPanel} role="group" aria-label="8種類の気持ち">
        <div className={styles.chipGrid}>
          {EMOTION_PICKER_KEYS.map((key) => {
            const selected = value === key;
            const popping = popKey === key;

            return (
              <button
                key={key}
                type="button"
                className={`${styles.chip}${selected ? ` ${styles.chipSelected}` : ''}${
                  popping ? ' hossii-pop' : ''
                }`}
                style={
                  {
                    '--emotion-color': EMOTION_COLORS[key],
                  } as CSSProperties
                }
                aria-pressed={selected}
                aria-label={EMOTION_PICKER_LABELS[key]}
                title={EMOTION_PICKER_LABELS[key]}
                onClick={() => handleSelect(key)}
              >
                <span className={styles.chipEmoji} aria-hidden>
                  {EMOJI_BY_EMOTION[key]}
                </span>
                <span className={styles.chipLabel}>{EMOTION_PICKER_LABELS[key]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {showHint && value && (
        <p className={`${styles.selectedHint} hossii-soft-bounce`} aria-live="polite">
          <span className={`${styles.hintEmoji} hossii-sparkle`} aria-hidden>
            {EMOJI_BY_EMOTION[value]}
          </span>
          {EMOTION_PICKER_LABELS[value]} — この気持ちを置く準備ができたよ
        </p>
      )}

      {error && !value && <p className={styles.errorText}>{errorMessage}</p>}
    </section>
  );
}
