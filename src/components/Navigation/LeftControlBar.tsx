import { Maximize2, Minimize2, Eye, EyeOff, Mic, MicOff, ScrollText, Volume2, VolumeX, ZoomIn } from 'lucide-react';
import type { DisplayScale } from '../../core/utils/displayScaleStorage';
import type { DisplayPeriod, DisplayLimit, ViewMode, LayoutMode } from '../../core/utils/displayPrefsStorage';
import type { Space } from '../../core/types/space';
import styles from './LeftControlBar.module.css';

export type ControlState = {
  isFullscreen: boolean;
  hossiiVisible: boolean;
  micEnabled: boolean;
  voiceEnabled: boolean;
};

type Props = {
  controls: ControlState;
  onToggle: (key: keyof ControlState) => void;
  onFullscreenToggle: () => void;
  displayScale: DisplayScale;
  onDisplayScaleCycle: () => void;
  displayPeriod: DisplayPeriod;
  onDisplayPeriodChange: (p: DisplayPeriod) => void;
  displayLimit: DisplayLimit;
  onDisplayLimitChange: (l: DisplayLimit) => void;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  layoutMode: LayoutMode;
  onLayoutModeChange: (m: LayoutMode) => void;
  neighbors?: Space[];
  onWarp?: () => void;
  isVisiting?: boolean;
  /** クイックログパネル（#57）開閉 */
  onQuickLogToggle?: () => void;
  quickLogOpen?: boolean;
};

const PERIOD_OPTIONS: { value: DisplayPeriod; label: string }[] = [
  { value: '1d', label: '1日' },
  { value: '1w', label: '1週' },
  { value: '1m', label: '1月' },
  { value: 'all', label: '全期' },
];

const LIMIT_OPTIONS: { value: DisplayLimit; label: string }[] = [
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 150, label: '150' },
  { value: 'unlimited', label: '∞' },
];

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string; title: string }[] = [
  { value: 'full', label: '📝', title: 'フル表示' },
  { value: 'bubble', label: '💬', title: 'バブル表示' },
  { value: 'image', label: '🖼', title: '画像のみ' },
  { value: 'slideshow', label: '🎞', title: 'スライドショー' },
];

const LAYOUT_MODE_OPTIONS: { value: LayoutMode; label: string; title: string }[] = [
  { value: 'random', label: '🔀', title: 'ランダム配置' },
  { value: 'ordered', label: '↔️', title: '投稿順に整列' },
];

export const LeftControlBar = ({
  controls,
  onToggle,
  onFullscreenToggle,
  displayScale,
  onDisplayScaleCycle,
  displayPeriod,
  onDisplayPeriodChange,
  displayLimit,
  onDisplayLimitChange,
  viewMode,
  onViewModeChange,
  layoutMode,
  onLayoutModeChange,
  neighbors = [],
  onWarp,
  isVisiting = false,
  onQuickLogToggle,
  quickLogOpen = false,
}: Props) => {
  const scalePercent = Math.round(displayScale * 100);

  const handleLimitChange = (limit: DisplayLimit) => {
    if (limit === 'unlimited') {
      // inline warning — no modal needed
      onDisplayLimitChange(limit);
    } else {
      onDisplayLimitChange(limit);
    }
  };

  return (
    <aside className={styles.controlBar}>
      {/* --- 既存トグルボタン群 --- */}
      <button
        className={`${styles.controlButton} ${styles.mobileVisible} ${controls.isFullscreen ? styles.active : ''}`}
        onClick={onFullscreenToggle}
        aria-label="画面サイズ調整"
        title="画面サイズ調整"
      >
        {controls.isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>

      <button
        className={`${styles.controlButton} ${styles.mobileVisible} ${controls.hossiiVisible ? styles.active : ''}`}
        onClick={() => onToggle('hossiiVisible')}
        aria-label="Hossii表示"
        title="Hossii表示"
      >
        {controls.hossiiVisible ? <Eye size={18} /> : <EyeOff size={18} />}
      </button>

      <button
        className={`${styles.controlButton} ${styles.mobileVisible} ${controls.micEnabled ? styles.active : ''}`}
        onClick={() => onToggle('micEnabled')}
        aria-label="マイク/音声"
        title="マイク/音声"
      >
        {controls.micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
      </button>

      <button
        className={`${styles.controlButton} ${styles.mobileVisible} ${controls.voiceEnabled ? styles.active : ''}`}
        onClick={() => onToggle('voiceEnabled')}
        aria-label="Hossiiの声"
        title="Hossiiの声（読み上げON/OFF）"
      >
        {controls.voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>

      <button
        className={styles.controlButton}
        onClick={onDisplayScaleCycle}
        aria-label="表示サイズを変更"
        title="表示サイズを変更"
      >
        <ZoomIn size={18} />
        <span className={styles.scaleLabel}>{scalePercent}%</span>
      </button>

      {onQuickLogToggle && (
        <button
          type="button"
          className={`${styles.controlButton} ${styles.mobileVisible} ${quickLogOpen ? styles.active : ''}`}
          onClick={onQuickLogToggle}
          aria-label="ログ一覧パネル"
          title="ログ一覧パネル"
          aria-pressed={quickLogOpen}
        >
          <ScrollText size={18} />
        </button>
      )}

      {/* --- 隣のスペースワープボタン --- */}
      {neighbors.length > 0 && !isVisiting && (
        <button
          className={`${styles.controlButton} ${styles.mobileVisible}`}
          onClick={onWarp}
          aria-label="隣のスペースにワープ"
          title="隣のスペースにワープ"
        >
          🏝
        </button>
      )}

      {/* --- 区切り線 --- */}
      <div className={styles.divider} />

      {/* --- F03: 表示モード --- */}
      <div className={styles.groupLabel}>表示</div>
      <div className={styles.buttonGroup}>
        {VIEW_MODE_OPTIONS.map(({ value, label, title }) => (
          <button
            key={value}
            className={`${styles.miniButton} ${viewMode === value ? styles.miniActive : ''}`}
            onClick={() => onViewModeChange(value)}
            title={title}
            aria-label={title}
          >
            {label}
          </button>
        ))}
      </div>

      {/* --- 区切り線 --- */}
      <div className={styles.divider} />

      {/* 吹き出し並び: ランダム / 投稿順 */}
      <div className={styles.groupLabel}>並び</div>
      <div className={styles.buttonGroup}>
        {LAYOUT_MODE_OPTIONS.map(({ value, label, title }) => (
          <button
            key={value}
            className={`${styles.miniButton} ${layoutMode === value ? styles.miniActive : ''}`}
            onClick={() => onLayoutModeChange(value)}
            title={title}
            aria-label={title}
          >
            {label}
          </button>
        ))}
      </div>

      {/* --- 区切り線 --- */}
      <div className={styles.divider} />

      {/* --- F11: 期間フィルタ --- */}
      <div className={styles.periodGroup}>
        <div className={styles.groupLabel}>期間</div>
        <div className={styles.buttonGroup}>
          {PERIOD_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              className={`${styles.miniButton} ${displayPeriod === value ? styles.miniActive : ''}`}
              onClick={() => onDisplayPeriodChange(value)}
              title={`表示期間: ${label}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* --- 区切り線 --- */}
      <div className={styles.divider} />

      {/* --- F12: 表示件数 --- */}
      <div className={styles.limitGroup}>
        <div className={styles.groupLabel}>件数</div>
        <div className={styles.buttonGroup}>
          {LIMIT_OPTIONS.map(({ value, label }) => (
            <button
              key={String(value)}
              className={`${styles.miniButton} ${displayLimit === value ? styles.miniActive : ''}`}
              onClick={() => handleLimitChange(value)}
              title={`表示件数: ${label === '∞' ? '無制限' : label + '件'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};
