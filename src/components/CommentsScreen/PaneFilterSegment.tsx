import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SpacePane } from '../../core/types/spacePane';
import type { CommentsPaneFilter } from '../../core/utils/commentsPaneFilterStorage';
import styles from './CommentsScreen.module.css';

export type PaneFilterValue = CommentsPaneFilter;

export type PaneFilterCountMode = 'current' | 'all' | 'specific';

type Props = {
  filter: PaneFilterValue;
  visiblePanes: SpacePane[];
  activePane: SpacePane | null;
  getCount: (mode: PaneFilterCountMode, paneId?: string) => number;
  onChange: (next: PaneFilterValue) => void;
  fetchLoading?: boolean;
};

function formatCount(count: number, loading: boolean, isActive: boolean): string {
  if (loading && isActive) return '…';
  return String(count);
}

export function PaneFilterSegment({
  filter,
  visiblePanes,
  activePane,
  getCount,
  onChange,
  fetchLoading = false,
}: Props) {
  const currentTabRef = useRef<HTMLButtonElement>(null);
  const allTabRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isCurrent = filter.mode === 'current';
  const isAll = filter.mode === 'all';
  const isSpecific = filter.mode === 'specific';

  const selectedSpecificPane = isSpecific
    ? visiblePanes.find((p) => p.id === filter.paneId) ?? null
    : null;

  const pillIndex = isCurrent ? 0 : isAll ? 1 : 2;

  const currentCount = getCount('current');
  const allCount = getCount('all');

  useEffect(() => {
    if (!dropdownOpen) return;
    const handlePointer = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    return () => document.removeEventListener('mousedown', handlePointer);
  }, [dropdownOpen]);

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent, target: 'current' | 'all') => {
      if (e.key === 'ArrowRight' && target === 'current') {
        e.preventDefault();
        onChange({ mode: 'all' });
        allTabRef.current?.focus();
      }
      if (e.key === 'ArrowLeft' && target === 'all') {
        e.preventDefault();
        onChange({ mode: 'current' });
        currentTabRef.current?.focus();
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onChange({ mode: target });
      }
    },
    [onChange],
  );

  const dropdownLabel = selectedSpecificPane?.name ?? '各タブ';

  return (
    <div
      className={styles.paneFilterTrack}
      role="tablist"
      aria-label="タブの表示範囲"
    >
      <div
        className={styles.paneFilterPill}
        style={{ transform: `translateX(${pillIndex * 100}%)` }}
        aria-hidden
      />
      <button
        ref={currentTabRef}
        type="button"
        role="tab"
        id="pane-filter-tab-current"
        aria-selected={isCurrent}
        aria-controls="log-scope-panel"
        title={activePane ? `現在のタブ: ${activePane.name}` : undefined}
        className={`${styles.paneFilterTab} ${isCurrent ? styles.paneFilterTabActive : ''}`}
        onClick={() => onChange({ mode: 'current' })}
        onKeyDown={(e) => handleTabKeyDown(e, 'current')}
      >
        このタブ
        <span className={styles.paneFilterCount}>
          ({formatCount(currentCount, fetchLoading, isCurrent)})
        </span>
      </button>
      <button
        ref={allTabRef}
        type="button"
        role="tab"
        id="pane-filter-tab-all"
        aria-selected={isAll}
        aria-controls="log-scope-panel"
        className={`${styles.paneFilterTab} ${isAll ? styles.paneFilterTabActive : ''}`}
        onClick={() => onChange({ mode: 'all' })}
        onKeyDown={(e) => handleTabKeyDown(e, 'all')}
      >
        すべてのタブ
        <span className={styles.paneFilterCount}>
          ({formatCount(allCount, fetchLoading, isAll)})
        </span>
      </button>
      <div className={styles.paneFilterDropdownWrap} ref={dropdownRef}>
        <button
          type="button"
          role="tab"
          id="pane-filter-tab-specific"
          aria-selected={isSpecific}
          aria-controls="log-scope-panel"
          aria-expanded={dropdownOpen}
          aria-haspopup="listbox"
          className={`${styles.paneFilterTab} ${styles.paneFilterDropdownBtn} ${
            isSpecific ? styles.paneFilterTabActive : ''
          }`}
          onClick={() => setDropdownOpen((open) => !open)}
        >
          <span className={styles.paneFilterDropdownLabel}>{dropdownLabel}</span>
          {isSpecific && selectedSpecificPane && (
            <span className={styles.paneFilterCount}>
              ({formatCount(getCount('specific', filter.paneId), fetchLoading, true)})
            </span>
          )}
          <ChevronDown size={14} className={styles.paneFilterChevron} aria-hidden />
        </button>
        {dropdownOpen && (
          <ul className={styles.paneFilterDropdown} role="listbox" aria-label="タブを選択">
            {visiblePanes.map((pane) => {
              const selected = isSpecific && filter.paneId === pane.id;
              const count = getCount('specific', pane.id);
              return (
                <li key={pane.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`${styles.paneFilterDropdownItem} ${
                      selected ? styles.paneFilterDropdownItemActive : ''
                    }`}
                    onClick={() => {
                      onChange({ mode: 'specific', paneId: pane.id });
                      setDropdownOpen(false);
                    }}
                  >
                    <span>{pane.name}</span>
                    <span className={styles.paneFilterDropdownItemCount}>({count})</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
