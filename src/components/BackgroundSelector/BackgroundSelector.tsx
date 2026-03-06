import { useState, useRef } from 'react';
import type { SpaceBackground } from '../../core/types/space';
import { MAX_BACKGROUND_IMAGES } from '../../core/types/space';
import { isSupabaseConfigured } from '../../core/supabase';
import { COLOR_PRESETS, PATTERN_PRESETS, THEME_PRESETS, createBackgroundFromPreset } from '../../core/utils/backgroundPresets';
import { uploadBackgroundImage, deleteBackgroundImage } from '../../core/utils/imageStorageApi';
import styles from './BackgroundSelector.module.css';

type BackgroundSelectorProps = {
  currentBackground?: SpaceBackground;
  onSelect: (background: SpaceBackground) => void;
  onImageURLRevoke?: (url: string) => void;
  spaceId?: string;
  savedBackgroundImages?: string[];
  onUpdateSavedImages?: (urls: string[]) => void;
};

export const BackgroundSelector = ({
  currentBackground,
  onSelect,
  onImageURLRevoke,
  spaceId,
  savedBackgroundImages = [],
  onUpdateSavedImages,
}: BackgroundSelectorProps) => {
  const [activeTab, setActiveTab] = useState<'color' | 'pattern' | 'theme' | 'image'>('pattern');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSelected = (kind: string, value: string): boolean => {
    if (!currentBackground) return false;
    return currentBackground.kind === kind && currentBackground.value === value;
  };

  // 画像を選択して背景に設定
  const handleSelectImage = (url: string) => {
    onSelect({ kind: 'image', value: url, source: 'cloud' });
  };

  // 画像を削除（ギャラリーから除去 + Supabase Storage から削除）
  const handleDeleteImage = async (url: string) => {
    // アクティブ背景だった場合はデフォルトにリセット
    if (currentBackground?.kind === 'image' && currentBackground.value === url) {
      onSelect({ kind: 'pattern', value: 'mist' });
    }
    const next = savedBackgroundImages.filter((u) => u !== url);
    onUpdateSavedImages?.(next);
    await deleteBackgroundImage(url);
  };

  // 新規画像をアップロードしてギャラリーに追加
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Supabase が設定されており spaceId があればクラウドへアップロード
    if (isSupabaseConfigured && spaceId) {
      setIsUploading(true);
      const publicUrl = await uploadBackgroundImage(spaceId, file);
      setIsUploading(false);

      if (publicUrl) {
        const next = [...savedBackgroundImages, publicUrl];
        onUpdateSavedImages?.(next);
        onSelect({ kind: 'image', value: publicUrl, source: 'cloud' });
        return;
      }
    }

    // Supabase 未設定 or アップロード失敗: objectURL で一時保存（ギャラリーには追加しない）
    const objectURL = URL.createObjectURL(file);
    onSelect({ kind: 'image', value: objectURL, source: 'temp' });
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
          className={`${styles.tab} ${activeTab === 'theme' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('theme')}
        >
          テーマ
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'image' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('image')}
        >
          画像
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

        {activeTab === 'theme' && (
          <div className={styles.themeList}>
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={`${styles.themeButton} ${isSelected('pattern', preset.key) ? styles.selected : ''}`}
                onClick={() => onSelect(createBackgroundFromPreset('pattern', preset.key))}
              >
                <div className={styles.themePreview} data-theme={preset.key} />
                <div className={styles.themeInfo}>
                  <p className={styles.themeLabel}>{preset.label}</p>
                  <p className={styles.themeDescription}>{preset.description}</p>
                </div>
                {isSelected('pattern', preset.key) && <span className={styles.themeCheck}>✓</span>}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'image' && (
          <div className={styles.imageSection}>
            {!isSupabaseConfigured && (
              <div className={styles.imageNote}>
                <span className={styles.noteIcon}>ℹ️</span>
                <span className={styles.noteText}>
                  Supabase 未設定のため画像は一時的です。リロードすると消えます。
                </span>
              </div>
            )}

            {/* ギャラリー: 保存済み画像 + 追加ボタン */}
            <div className={styles.imageGallery}>
              {savedBackgroundImages.map((url) => {
                const isActive = currentBackground?.kind === 'image' && currentBackground.value === url;
                return (
                  <div
                    key={url}
                    className={`${styles.galleryItem} ${isActive ? styles.galleryItemActive : ''}`}
                  >
                    <button
                      type="button"
                      className={styles.galleryThumb}
                      onClick={() => handleSelectImage(url)}
                      title="この画像を背景に設定"
                    >
                      <img src={url} alt="背景画像" className={styles.galleryImg} />
                      {isActive && <span className={styles.galleryCheck}>✓</span>}
                    </button>
                    <button
                      type="button"
                      className={styles.galleryDelete}
                      onClick={() => handleDeleteImage(url)}
                      title="削除"
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              {/* 追加ボタン（上限未満のときのみ表示） */}
              {savedBackgroundImages.length < MAX_BACKGROUND_IMAGES && (
                <label
                  className={`${styles.galleryAdd} ${isUploading ? styles.galleryAddDisabled : ''}`}
                  title={`画像を追加（最大${MAX_BACKGROUND_IMAGES}枚）`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className={styles.fileInput}
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                  <span className={styles.galleryAddIcon}>
                    {isUploading ? '…' : '+'}
                  </span>
                  <span className={styles.galleryAddLabel}>
                    {isUploading ? 'アップロード中' : '追加'}
                  </span>
                </label>
              )}
            </div>

            <p className={styles.galleryCount}>
              {savedBackgroundImages.length} / {MAX_BACKGROUND_IMAGES} 枚
            </p>

            <button
              type="button"
              className={styles.resetButton}
              onClick={handleReset}
              disabled={isUploading}
            >
              デフォルトに戻す
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
