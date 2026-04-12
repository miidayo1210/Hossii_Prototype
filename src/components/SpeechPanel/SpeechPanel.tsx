import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { SpeechLevelSettings } from '../../core/utils/listenStorage';
import { getDefaultSpeechRect } from '../../core/utils/floatingPanelStorage';
import { FloatingPanelShell } from '../FloatingPanelShell/FloatingPanelShell';
import styles from './SpeechPanel.module.css';

type Props = {
  /** マイク（Listen）が有効か — 左バーまたはこのパネルのボタンと同期 */
  listenMode: boolean;
  /** Listen ON/OFF（未同意時は親が同意モーダルを出す） */
  onListenToggle: () => void;
  confirmedText: string;
  interimText: string;
  speechLevels: SpeechLevelSettings;
  setSpeechLevels: (levels: SpeechLevelSettings) => void;
  /** 候補をそのままスペースに投稿 */
  onPost: (text: string) => void;
  /** 右の「気持ちを置く」パネルで編集 */
  onEditCandidate: (text: string) => void;
  /** 候補から除外（×） */
  onDismissCandidate: (text: string) => void;
  dismissedCandidates: string[];
  onClose: () => void;
  /** クイック投稿のフリー編集へ候補を送る（定義時のみボタン表示） */
  onSendCandidateToFreePost?: (text: string) => void;
};

type PanelLevel = 'short' | 'long';

const MAX_CANDIDATES = 5;

function extractCandidates(text: string, level: PanelLevel): string[] {
  if (!text.trim()) return [];

  const separator = level === 'long' ? /[。！？!?]/ : /[、。！？!?, ]/;
  const segments = text
    .split(separator)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const filtered =
    level === 'long'
      ? segments.filter((s) => s.length > 10)
      : segments.filter((s) => s.length >= 2 && s.length <= 30);

  return filtered.slice(-MAX_CANDIDATES).reverse();
}

function SpeechPanelInner({
  listenMode,
  onListenToggle,
  confirmedText,
  interimText,
  speechLevels,
  setSpeechLevels,
  onPost,
  onEditCandidate,
  onDismissCandidate,
  dismissedCandidates,
  onClose,
  onSendCandidateToFreePost,
}: Props) {
  const [panelLevel, setPanelLevel] = useState<PanelLevel>('short');
  const textAreaRef = useRef<HTMLDivElement>(null);

  const stopDrag = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  const handleLevelToggle = (level: PanelLevel) => {
    setPanelLevel(level);
    setSpeechLevels({
      ...speechLevels,
      word: false,
      short: level === 'short',
      long: level === 'long',
    });
  };

  useEffect(() => {
    const el = textAreaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [confirmedText, interimText]);

  const candidates = useMemo(() => {
    const raw = extractCandidates(confirmedText, panelLevel);
    return raw.filter((c) => !dismissedCandidates.includes(c));
  }, [confirmedText, panelLevel, dismissedCandidates]);

  return (
    <div className={styles.panelInner}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>🎙</span>
        <span className={styles.headerTitle}>音声テキスト</span>
        <button
          type="button"
          className={`${styles.micCompact} ${listenMode ? styles.micCompactOn : styles.micCompactOff}`}
          onClick={onListenToggle}
          onPointerDown={stopDrag}
          aria-pressed={listenMode}
          aria-label={`マイク${listenMode ? 'オフ' : 'オン'}`}
        >
          <span className={styles.micCompactEmoji} aria-hidden>
            🎤
          </span>
          <span className={styles.micCompactLabel}>{listenMode ? 'ON' : 'OFF'}</span>
        </button>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          onPointerDown={stopDrag}
        >
          ✕
        </button>
      </div>

      <div className={styles.textArea} ref={textAreaRef} data-no-drag>
        {!listenMode ? (
          <span className={styles.placeholderMuted}>
            音声入力を ON にすると、話した内容がここに文字起こしされます。
          </span>
        ) : confirmedText || interimText ? (
          <>
            <span className={styles.confirmedText}>{confirmedText}</span>
            {interimText && <span className={styles.interimText}>{interimText}</span>}
          </>
        ) : (
          <span className={styles.placeholder}>話すとここに文字起こしが表示されます</span>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.candidatesSection} data-no-drag>
        <div className={styles.candidatesLabel}>候補</div>
        {candidates.length > 0 ? (
          <ul className={styles.candidatesList}>
            {candidates.map((candidate, i) => (
              <li key={`${candidate}-${i}`} className={styles.candidateRow}>
                <span className={styles.candidateText} title={candidate}>
                  {candidate}
                </span>
                <div className={styles.candidateActions}>
                  <button
                    type="button"
                    className={styles.candidateActionBtn}
                    onClick={() => onEditCandidate(candidate)}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    className={`${styles.candidateActionBtn} ${styles.candidateActionPrimary}`}
                    onClick={() => onPost(candidate)}
                  >
                    スペースに置く
                  </button>
                  {onSendCandidateToFreePost && (
                    <button
                      type="button"
                      className={styles.candidateActionBtn}
                      onClick={() => onSendCandidateToFreePost(candidate)}
                      title="クイック投稿のフリータブへ"
                    >
                      フリーに入れる
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${styles.candidateActionBtn} ${styles.candidateActionDismiss}`}
                    onClick={() => onDismissCandidate(candidate)}
                    aria-label="候補を削除"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.noCandidates}>
            {confirmedText ? '該当する候補がありません' : 'まだ候補がありません'}
          </p>
        )}
      </div>

      <div className={styles.granularityRow} data-no-drag>
        <span className={styles.granularityLabel}>粒度:</span>
        <button
          type="button"
          className={`${styles.granularityButton} ${panelLevel === 'short' ? styles.granularityActive : ''}`}
          onClick={() => handleLevelToggle('short')}
        >
          短め
        </button>
        <button
          type="button"
          className={`${styles.granularityButton} ${panelLevel === 'long' ? styles.granularityActive : ''}`}
          onClick={() => handleLevelToggle('long')}
        >
          長め
        </button>
      </div>
    </div>
  );
}

export function SpeechPanel(props: Props) {
  const defaultRect = useMemo(() => getDefaultSpeechRect(), []);

  return (
    <FloatingPanelShell
      storageKey="speech"
      defaultRect={defaultRect}
      minW={280}
      minH={180}
      zIndex={300}
      className={styles.floatingChrome}
    >
      <SpeechPanelInner {...props} />
    </FloatingPanelShell>
  );
}
