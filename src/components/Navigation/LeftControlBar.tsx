import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, Eye, EyeOff, Hash, Info, Mic, MicOff, MoreHorizontal, QrCode, Users, Volume2, VolumeX, ZoomIn } from 'lucide-react';
import type { DisplayScale } from '../../core/utils/displayScaleStorage';
import type { DisplayPeriod, DisplayLimit, ViewMode, LayoutMode } from '../../core/utils/displayPrefsStorage';
import type { Space } from '../../core/types/space';
import { useMediaQuery } from '../../core/hooks/useMediaQuery';
import { Tooltip } from '../common/Tooltip';
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
  /** QRコードパネルの表示切替 */
  qrPanelVisible?: boolean;
  onQrToggle?: () => void;
  /** スペース説明パネルの表示切替（PC） */
  descriptionPanelVisible?: boolean;
  onDescriptionToggle?: () => void;
  /** スペース右上に現在の表示条件での投稿数を出す */
  showPostCountBadge?: boolean;
  onShowPostCountBadgeToggle?: () => void;
  /** 大画面トグルの説明文をスマホ向けに変える（仕様71） */
  isMobile?: boolean;
  /** スペース画面タグ絞り込み（モバイル ... メニュー） */
  tagFilterCandidates?: string[];
  activeTagFilter?: string | null;
  onTagFilterChange?: (tag: string | null) => void;
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

const LAYOUT_MODE_OPTIONS: { value: LayoutMode; label: React.ReactNode; title: string }[] = [
  { value: 'random', label: '🔀', title: 'ランダム配置' },
  { value: 'ordered', label: '↔️', title: '投稿順に整列' },
  { value: 'byAuthor', label: <Users size={14} />, title: '同じ人の投稿を1つにまとめて表示' },
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
  qrPanelVisible = true,
  onQrToggle,
  descriptionPanelVisible = true,
  onDescriptionToggle,
  showPostCountBadge = false,
  onShowPostCountBadgeToggle,
  isMobile = false,
  tagFilterCandidates = [],
  activeTagFilter = null,
  onTagFilterChange,
}: Props) => {
  const scalePercent = Math.round(displayScale * 100);
  const isMobileLayout = useMediaQuery('(max-width: 768px), (max-height: 600px) and (orientation: landscape)');
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  const overflowTriggerRef = useRef<HTMLButtonElement>(null);
  const overflowPanelRef = useRef<HTMLDivElement>(null);
  const [overflowPanelStyle, setOverflowPanelStyle] = useState<React.CSSProperties | undefined>();

  const updateOverflowPanelPosition = useCallback(() => {
    if (!isMobileLayout || !overflowOpen) {
      setOverflowPanelStyle(undefined);
      return;
    }
    const trigger = overflowTriggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setOverflowPanelStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left: Math.max(8, rect.left),
      zIndex: 1100,
    });
  }, [isMobileLayout, overflowOpen]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      updateOverflowPanelPosition();
    });
    return () => cancelAnimationFrame(frame);
  }, [updateOverflowPanelPosition]);

  useEffect(() => {
    if (!isMobileLayout || !overflowOpen) return;
    window.addEventListener('resize', updateOverflowPanelPosition);
    window.addEventListener('scroll', updateOverflowPanelPosition, true);
    return () => {
      window.removeEventListener('resize', updateOverflowPanelPosition);
      window.removeEventListener('scroll', updateOverflowPanelPosition, true);
    };
  }, [isMobileLayout, overflowOpen, updateOverflowPanelPosition]);

  const handleLimitChange = (limit: DisplayLimit) => {
    onDisplayLimitChange(limit);
  };

  const handleOverflowToggle = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setOverflowOpen((v) => !v);
  }, []);

  // オーバーフローパネル外タップで閉じる（開いた直後の同一タップを避けるため 1 フレーム遅延）
  useEffect(() => {
    if (!overflowOpen) return;
    let handler: ((e: PointerEvent) => void) | null = null;
    const timeoutId = window.setTimeout(() => {
      handler = (e: PointerEvent) => {
        const target = e.target as Node;
        if (overflowRef.current?.contains(target)) return;
        if (overflowPanelRef.current?.contains(target)) return;
        setOverflowOpen(false);
      };
      document.addEventListener('pointerdown', handler);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      if (handler) {
        document.removeEventListener('pointerdown', handler);
      }
    };
  }, [overflowOpen]);

  return (
    <aside className={styles.controlBar}>
      {/* --- 既存トグルボタン群 --- */}
      {!isMobile && (
        <Tooltip text={controls.isFullscreen ? '画面を元に戻す' : '表示領域を広げる'}>
          <button
            className={`${styles.controlButton} ${controls.isFullscreen ? styles.active : ''}`}
            onClick={onFullscreenToggle}
            aria-label={controls.isFullscreen ? '大画面表示を終了' : '大画面表示'}
          >
            {controls.isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </Tooltip>
      )}

      <Tooltip text={controls.hossiiVisible ? 'Hossii を隠す' : 'Hossii を表示'}>
        <button
          className={`${styles.controlButton} ${styles.mobileVisible} ${controls.hossiiVisible ? styles.active : ''}`}
          onClick={() => onToggle('hossiiVisible')}
          aria-label="Hossii 表示切替"
        >
          {controls.hossiiVisible ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </Tooltip>

      <Tooltip text={controls.micEnabled ? 'マイク入力 ON（タップで OFF）' : 'マイクで投稿する（音声入力）'}>
        <button
          className={`${styles.controlButton} ${styles.mobileVisible} ${controls.micEnabled ? styles.active : ''}`}
          onClick={() => onToggle('micEnabled')}
          aria-label="マイク入力切替"
        >
          {controls.micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
      </Tooltip>

      <Tooltip text={controls.voiceEnabled ? 'Hossii の読み上げ ON（タップで OFF）' : 'Hossii の読み上げをオンにする'}>
        <button
          className={`${styles.controlButton} ${styles.mobileVisible} ${controls.voiceEnabled ? styles.active : ''}`}
          onClick={() => onToggle('voiceEnabled')}
          aria-label="読み上げ切替"
        >
          {controls.voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </Tooltip>

      <Tooltip text={`表示サイズを変更（現在 ${scalePercent}%）`}>
        <button
          className={styles.controlButton}
          onClick={onDisplayScaleCycle}
          aria-label="表示サイズを変更"
        >
          <ZoomIn size={18} />
          <span className={styles.scaleLabel}>{scalePercent}%</span>
        </button>
      </Tooltip>

      {onShowPostCountBadgeToggle && (
        <Tooltip text={showPostCountBadge ? '投稿数バッジを隠す' : '現在の投稿数を右上に表示'}>
          <button
            type="button"
            className={`${styles.controlButton} ${styles.mobileVisible} ${showPostCountBadge ? styles.active : ''}`}
            onClick={onShowPostCountBadgeToggle}
            aria-label={showPostCountBadge ? '投稿数表示をオフ' : '投稿数表示をオン'}
            aria-pressed={showPostCountBadge}
          >
            <Hash size={18} />
          </button>
        </Tooltip>
      )}

      {onDescriptionToggle && (
        <Tooltip text={descriptionPanelVisible ? 'スペース説明を隠す' : 'スペース説明を表示'}>
          <button
            type="button"
            className={`${styles.controlButton} ${descriptionPanelVisible ? styles.active : ''}`}
            onClick={onDescriptionToggle}
            aria-label={descriptionPanelVisible ? 'スペース説明を隠す' : 'スペース説明を表示'}
            aria-pressed={descriptionPanelVisible}
          >
            <Info size={18} />
          </button>
        </Tooltip>
      )}

      {onQrToggle && (
        <Tooltip text={qrPanelVisible ? 'QR コードを隠す' : 'QR コードを表示'}>
          <button
            type="button"
            className={`${styles.controlButton} ${styles.mobileVisible} ${qrPanelVisible ? styles.active : ''}`}
            onClick={onQrToggle}
            aria-label={qrPanelVisible ? 'QRコードパネルを隠す' : 'QRコードパネルを表示'}
            aria-pressed={qrPanelVisible}
          >
            <QrCode size={18} />
          </button>
        </Tooltip>
      )}

      {/* --- 隣のスペース: 自スペースでワープ / 訪問中は自スペースに戻る --- */}
      {neighbors.length > 0 && (
        <Tooltip text={isVisiting ? '自分のスペースに戻る' : '隣のスペースへワープ'}>
          <button
            type="button"
            className={`${styles.controlButton} ${styles.mobileVisible}`}
            onClick={onWarp}
            aria-label={isVisiting ? '自スペースに戻る' : '隣のスペースにワープ'}
          >
            🏝
          </button>
        </Tooltip>
      )}

      {/* --- 区切り線 --- */}
      <div className={styles.divider} />

      {/* --- ... オーバーフローメニュー --- */}
      <div ref={overflowRef} className={`${styles.overflowWrapper} ${styles.mobileVisible}`}>
        <Tooltip text="表示設定・詳細メニュー">
          <button
            ref={overflowTriggerRef}
            type="button"
            className={`${styles.controlButton} ${styles.mobileVisible} ${overflowOpen ? styles.active : ''}`}
            onClick={handleOverflowToggle}
            aria-label="詳細メニューを開く"
            aria-expanded={overflowOpen}
          >
            <MoreHorizontal size={18} />
          </button>
        </Tooltip>

        {overflowOpen && !isMobileLayout && (
          <div ref={overflowPanelRef} className={styles.overflowPanel} role="menu">
            {renderOverflowMenuContent({
              viewMode,
              onViewModeChange,
              layoutMode,
              onLayoutModeChange,
              displayPeriod,
              onDisplayPeriodChange,
              displayLimit,
              handleLimitChange,
              tagFilterCandidates,
              activeTagFilter,
              onTagFilterChange,
              styles,
            })}
          </div>
        )}
      </div>

      {overflowOpen &&
        isMobileLayout &&
        createPortal(
          <div
            ref={overflowPanelRef}
            className={`${styles.overflowPanel} ${styles.overflowPanelMobile}`}
            style={overflowPanelStyle}
            role="menu"
          >
            {renderOverflowMenuContent({
              viewMode,
              onViewModeChange,
              layoutMode,
              onLayoutModeChange,
              displayPeriod,
              onDisplayPeriodChange,
              displayLimit,
              handleLimitChange,
              tagFilterCandidates,
              activeTagFilter,
              onTagFilterChange,
              styles,
            })}
          </div>,
          document.body,
        )}
    </aside>
  );
};

type OverflowMenuContentProps = {
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  layoutMode: LayoutMode;
  onLayoutModeChange: (m: LayoutMode) => void;
  displayPeriod: DisplayPeriod;
  onDisplayPeriodChange: (p: DisplayPeriod) => void;
  displayLimit: DisplayLimit;
  handleLimitChange: (l: DisplayLimit) => void;
  tagFilterCandidates?: string[];
  activeTagFilter?: string | null;
  onTagFilterChange?: (tag: string | null) => void;
  styles: typeof styles;
};

function renderOverflowMenuContent({
  viewMode,
  onViewModeChange,
  layoutMode,
  onLayoutModeChange,
  displayPeriod,
  onDisplayPeriodChange,
  displayLimit,
  handleLimitChange,
  tagFilterCandidates = [],
  activeTagFilter = null,
  onTagFilterChange,
  styles,
}: OverflowMenuContentProps) {
  return (
    <>
            {/* 表示モード */}
            <div className={styles.overflowSection}>
              <div className={styles.overflowLabel}>表示</div>
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
            </div>

            <div className={styles.overflowDivider} />

            {/* 並び順 */}
            <div className={styles.overflowSection}>
              <div className={styles.overflowLabel}>並び</div>
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
            </div>

            <div className={styles.overflowDivider} />

            {/* 期間フィルタ */}
            <div className={styles.overflowSection}>
              <div className={styles.overflowLabel}>期間</div>
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

            <div className={styles.overflowDivider} />

            {/* 表示件数 */}
            <div className={styles.overflowSection}>
              <div className={styles.overflowLabel}>件数</div>
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

            {onTagFilterChange && tagFilterCandidates.length > 0 && (
              <>
                <div className={styles.overflowDivider} />
                <div className={styles.overflowSection}>
                  <div className={styles.overflowLabel}>タグで絞る</div>
                  <div className={styles.buttonGroup}>
                    <button
                      type="button"
                      className={`${styles.miniButton} ${activeTagFilter == null ? styles.miniActive : ''}`}
                      onClick={() => onTagFilterChange(null)}
                      title="すべて表示"
                    >
                      すべて
                    </button>
                    {tagFilterCandidates.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={`${styles.miniButton} ${activeTagFilter === tag ? styles.miniActive : ''}`}
                        onClick={() => onTagFilterChange(tag)}
                        title={`#${tag}`}
                      >
                        #{tag.length > 6 ? `${tag.slice(0, 6)}…` : tag}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
    </>
  );
}
