import { useCallback, useRef } from 'react';
import type { LogScope } from '../../core/utils/logScopeStorage';
import styles from './CommentsScreen.module.css';

type Props = {
  scope: LogScope;
  allCount: number;
  mineCount: number;
  onChange: (scope: LogScope) => void;
  compact?: boolean;
};

export function LogScopeSegment({ scope, allCount, mineCount, onChange, compact = false }: Props) {
  const allTabRef = useRef<HTMLButtonElement>(null);
  const mineTabRef = useRef<HTMLButtonElement>(null);

  const allLabel = compact ? '全体' : '全体のログ';
  const mineLabel = compact ? '私' : '私のログ';
  const allTitle = compact ? '全体のログ' : undefined;
  const mineTitle = compact ? '私のログ' : undefined;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, tab: LogScope) => {
      if (e.key === 'ArrowRight' && tab === 'all') {
        e.preventDefault();
        onChange('mine');
        mineTabRef.current?.focus();
      }
      if (e.key === 'ArrowLeft' && tab === 'mine') {
        e.preventDefault();
        onChange('all');
        allTabRef.current?.focus();
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onChange(tab);
      }
    },
    [onChange]
  );

  return (
    <div
      className={`${styles.logScopeTrack} ${compact ? styles.logScopeTrackCompact : ''}`}
      role="tablist"
      aria-label="ログの表示範囲"
    >
      <div
        className={`${styles.logScopePill} ${scope === 'mine' ? styles.logScopePillMine : ''}`}
        aria-hidden
      />
      <button
        ref={allTabRef}
        type="button"
        role="tab"
        id="log-scope-tab-all"
        aria-selected={scope === 'all'}
        aria-controls="log-scope-panel"
        title={allTitle}
        className={`${styles.logScopeTab} ${scope === 'all' ? styles.logScopeTabActive : ''}`}
        onClick={() => onChange('all')}
        onKeyDown={(e) => handleKeyDown(e, 'all')}
      >
        {allLabel}
        <span className={styles.logScopeCount}>({allCount})</span>
      </button>
      <button
        ref={mineTabRef}
        type="button"
        role="tab"
        id="log-scope-tab-mine"
        aria-selected={scope === 'mine'}
        aria-controls="log-scope-panel"
        title={mineTitle}
        className={`${styles.logScopeTab} ${scope === 'mine' ? styles.logScopeTabActive : ''}`}
        onClick={() => onChange('mine')}
        onKeyDown={(e) => handleKeyDown(e, 'mine')}
      >
        {mineLabel}
        <span className={styles.logScopeCount}>({mineCount})</span>
      </button>
    </div>
  );
}
