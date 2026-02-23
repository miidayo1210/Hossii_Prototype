import { useState, useRef } from 'react';
import type { SpaceBackground } from '../../core/types/space';
import { COLOR_PRESETS, PATTERN_PRESETS, createBackgroundFromPreset } from '../../core/utils/backgroundPresets';
import styles from './BackgroundSelector.module.css';

type BackgroundSelectorProps = {
  currentBackground?: SpaceBackground;
  onSelect: (background: SpaceBackground) => void;
  onImageURLRevoke?: (url: string) => void;
};

export const BackgroundSelector = ({ currentBackground, onSelect, onImageURLRevoke }: BackgroundSelectorProps) => {
  const [activeTab, setActiveTab] = useState<'color' | 'pattern' | 'image'>('pattern');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSelected = (kind: string, value: string): boolean => {
    if (!currentBackground) return false;
    return currentBackground.kind === kind && currentBackground.value === value;
  };

  // 画像ファイルが選択されたときの処理
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 画像ファイルかチェック
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください');
      return;
    }

    // 古い一時画像の objectURL を解放
    if (
      currentBackground?.kind === 'image' &&
      currentBackground.source === 'temp' &&
      onImageURLRevoke
    ) {
      onImageURLRevoke(currentBackground.value);
    }

    // 新しい objectURL を作成
    const objectURL = URL.createObjectURL(file);

    // 背景を更新
    onSelect({ kind: 'image', value: objectURL, source: 'temp' });

    // ファイル選択をリセット（同じファイルを再選択可能にする）
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // デフォルト背景にリセット
  const handleReset = () => {
    // 古い一時画像の objectURL を解放
    if (
      currentBackground?.kind === 'image' &&
      currentBackground.source === 'temp' &&
      onImageURLRevoke
    ) {
      onImageURLRevoke(currentBackground.value);
    }

    // デフォルトのミストパターンに戻す
    onSelect({ kind: 'pattern', value: 'mist' });
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'color' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('color')}
        >
          色
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'pattern' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('pattern')}
        >
          パターン
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'image' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('image')}
        >
          画像（仮）
        </button>
      </div>

      <div className={styles.presets}>
        {activeTab === 'color' && (
          <div className={styles.colorGrid}>
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={`${styles.colorButton} ${isSelected('color', preset.value) ? styles.selected : ''}`}
                style={{ backgroundColor: preset.value }}
                onClick={() => onSelect(createBackgroundFromPreset('color', preset.value))}
                title={preset.label}
              >
                {isSelected('color', preset.value) && <span className={styles.checkmark}>✓</span>}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'pattern' && (
          <div className={styles.patternList}>
            {PATTERN_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={`${styles.patternButton} ${isSelected('pattern', preset.key) ? styles.selected : ''}`}
                onClick={() => onSelect(createBackgroundFromPreset('pattern', preset.key))}
              >
                <div className={styles.patternPreview} data-pattern={preset.key} />
                <span className={styles.patternLabel}>{preset.label}</span>
                {isSelected('pattern', preset.key) && <span className={styles.check}>✓</span>}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'image' && (
          <div className={styles.imageSection}>
            <div className={styles.imageNote}>
              <span className={styles.noteIcon}>ℹ️</span>
              <span className={styles.noteText}>
                画像は一時的です。リロードすると消えます。
              </span>
            </div>

            <div className={styles.imageControls}>
              <label className={styles.fileLabel}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className={styles.fileInput}
                  onChange={handleImageSelect}
                />
                <span className={styles.fileLabelText}>
                  {currentBackground?.kind === 'image' && currentBackground.source === 'temp'
                    ? '別の画像を選択'
                    : '画像を選択'}
                </span>
              </label>

              {currentBackground?.kind === 'image' && currentBackground.source === 'temp' && (
                <div className={styles.imagePreview}>
                  <img
                    src={currentBackground.value}
                    alt="選択された背景画像"
                    className={styles.previewImage}
                  />
                </div>
              )}

              <button
                type="button"
                className={styles.resetButton}
                onClick={handleReset}
              >
                デフォルトに戻す
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
