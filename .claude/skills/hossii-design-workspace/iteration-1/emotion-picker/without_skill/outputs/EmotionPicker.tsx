import { useCallback, useState } from 'react';
import styles from './EmotionPicker.module.css';

export type EmotionKey =
  | 'wow'
  | 'empathy'
  | 'inspire'
  | 'think'
  | 'laugh'
  | 'joy'
  | 'moved'
  | 'fun';

const ALL_EMOTIONS: EmotionKey[] = [
  'joy',
  'wow',
  'think',
  'empathy',
  'inspire',
  'laugh',
  'moved',
  'fun',
];

const EMOTION_LABELS: Record<EmotionKey, string> = {
  wow: 'Wow',
  empathy: '刺さった',
  inspire: '閃いた',
  think: '気になる',
  laugh: '笑った',
  joy: 'うれしい',
  moved: 'ぐっときた',
  fun: '楽しい',
};

const EMOJI_BY_EMOTION: Record<EmotionKey, string> = {
  wow: '😮',
  empathy: '😍',
  inspire: '🤯',
  think: '🤔',
  laugh: '😂',
  joy: '🥰',
  moved: '😢',
  fun: '✨',
};

export type EmotionPickerProps = {
  /** Controlled selected emotion */
  value?: EmotionKey | null;
  /** Called when the user selects or clears an emotion */
  onChange?: (emotion: EmotionKey | null) => void;
  /** Uncontrolled initial selection */
  defaultValue?: EmotionKey | null;
  /** Section label shown above the picker */
  label?: string;
  /** Show a required badge next to the label */
  required?: boolean;
  /** Show selected emotion hint below the bar */
  showHint?: boolean;
  /** Allow clicking the same emotion again to deselect */
  allowDeselect?: boolean;
  /** Optional class name for the root element */
  className?: string;
};

export function EmotionPicker({
  value,
  onChange,
  defaultValue = null,
  label = '気持ちを選ぶ',
  required = false,
  showHint = true,
  allowDeselect = true,
  className,
}: EmotionPickerProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<EmotionKey | null>(defaultValue);
  const selected = isControlled ? value : internalValue;

  const handleSelect = useCallback(
    (emotion: EmotionKey) => {
      const next = allowDeselect && selected === emotion ? null : emotion;
      if (!isControlled) {
        setInternalValue(next);
      }
      onChange?.(next);
    },
    [allowDeselect, isControlled, onChange, selected],
  );

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <div className={styles.labelRow}>
        <span className={styles.label}>{label}</span>
        {required && <span className={styles.requiredBadge}>必須</span>}
      </div>

      <div
        className={styles.emotionBar}
        role="radiogroup"
        aria-label={label}
      >
        {ALL_EMOTIONS.map((key) => {
          const isSelected = selected === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={EMOTION_LABELS[key]}
              title={EMOTION_LABELS[key]}
              className={`${styles.emotionChip} ${isSelected ? styles.emotionChipSelected : ''}`}
              onClick={() => handleSelect(key)}
            >
              <span className={styles.emotionChipEmoji} aria-hidden="true">
                {EMOJI_BY_EMOTION[key]}
              </span>
              <span className={styles.emotionChipLabel}>{EMOTION_LABELS[key]}</span>
            </button>
          );
        })}
      </div>

      {showHint && selected && (
        <p className={styles.selectedHint}>
          {EMOJI_BY_EMOTION[selected]} {EMOTION_LABELS[selected]}
        </p>
      )}
    </div>
  );
}

export { ALL_EMOTIONS, EMOTION_LABELS, EMOJI_BY_EMOTION };
