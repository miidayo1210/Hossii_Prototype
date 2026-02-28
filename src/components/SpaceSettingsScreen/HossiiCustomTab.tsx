import { useRef, useState } from 'react';
import { Upload, X, Plus, Trash2 } from 'lucide-react';
import { generateId } from '../../core/utils';
import type { SpaceSettings, HossiiColor } from '../../core/types/settings';
import type { Space, CustomEmotion } from '../../core/types/space';
import styles from './HossiiCustomTab.module.css';

type Props = {
  settings: SpaceSettings;
  onUpdate: (settings: SpaceSettings) => void;
  space?: Space;
  onUpdateSpace?: (patch: Partial<Space>) => void;
};

const COLOR_OPTIONS: Array<{ value: HossiiColor; label: string; hex: string }> = [
  { value: 'pink', label: 'ピンク', hex: '#ec4899' },
  { value: 'blue', label: 'ブルー', hex: '#3b82f6' },
  { value: 'yellow', label: 'イエロー', hex: '#fbbf24' },
  { value: 'green', label: 'グリーン', hex: '#10b981' },
  { value: 'purple', label: 'パープル', hex: '#a855f7' },
];

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export const HossiiCustomTab = ({ settings, onUpdate, space, onUpdateSpace }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emotionFileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showEmotionEditor, setShowEmotionEditor] = useState(false);
  const [newEmotionLabel, setNewEmotionLabel] = useState('');
  const [newEmotionPreview, setNewEmotionPreview] = useState<string | null>(null);
  const [emotionUploadError, setEmotionUploadError] = useState<string | null>(null);

  const handleColorChange = (color: HossiiColor) => {
    onUpdate({ ...settings, hossiiColor: color });
  };

  const selectedColor = COLOR_OPTIONS.find((c) => c.value === settings.hossiiColor);

  // ---- キャラクター画像アップロード ----
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('画像ファイルを選択してください'));
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        reject(new Error('ファイルサイズが2MBを超えています'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
      reader.readAsDataURL(file);
    });
  };

  const handleCharacterFileSelect = async (file: File) => {
    setUploadError(null);
    try {
      const dataUrl = await processImageFile(file);
      onUpdateSpace?.({ characterImageUrl: dataUrl });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'アップロードに失敗しました');
    }
  };

  const handleCharacterInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleCharacterFileSelect(file);
    e.target.value = '';
  };

  const handleCharacterDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleCharacterFileSelect(file);
  };

  const handleRemoveCharacter = () => {
    onUpdateSpace?.({ characterImageUrl: undefined });
    setUploadError(null);
  };

  // ---- カスタム表情 ----
  const customEmotions = space?.customEmotions ?? [];

  const handleEmotionFileSelect = async (file: File) => {
    setEmotionUploadError(null);
    try {
      const dataUrl = await processImageFile(file);
      setNewEmotionPreview(dataUrl);
    } catch (err) {
      setEmotionUploadError(err instanceof Error ? err.message : 'アップロードに失敗しました');
    }
  };

  const handleEmotionInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleEmotionFileSelect(file);
    e.target.value = '';
  };

  const handleAddEmotion = () => {
    if (!newEmotionPreview) {
      setEmotionUploadError('画像を選択してください');
      return;
    }
    if (customEmotions.length >= 20) {
      setEmotionUploadError('表情は最大20件まで登録できます');
      return;
    }
    const newEmotion: CustomEmotion = {
      id: generateId(),
      label: newEmotionLabel.trim() || undefined,
      imageUrl: newEmotionPreview,
      width: 80,
      height: 80,
    };
    onUpdateSpace?.({ customEmotions: [...customEmotions, newEmotion] });
    setNewEmotionPreview(null);
    setNewEmotionLabel('');
    setShowEmotionEditor(false);
    setEmotionUploadError(null);
  };

  const handleDeleteEmotion = (id: string) => {
    onUpdateSpace?.({ customEmotions: customEmotions.filter((e) => e.id !== id) });
  };

  const handleEmotionSizeChange = (id: string, size: number) => {
    onUpdateSpace?.({
      customEmotions: customEmotions.map((e) =>
        e.id === id ? { ...e, width: size, height: size } : e
      ),
    });
  };

  return (
    <div className={styles.container}>
      {/* ---- カラー ---- */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Hossiiのカラー</h2>
        <p className={styles.description}>
          このスペースに住むHossiiの色を選択してください
        </p>

        <div className={styles.colorGrid}>
          {COLOR_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`${styles.colorButton} ${
                settings.hossiiColor === option.value ? styles.selected : ''
              }`}
              onClick={() => handleColorChange(option.value)}
              style={{ '--color': option.hex } as React.CSSProperties}
            >
              <div className={styles.colorCircle}></div>
              <span className={styles.colorLabel}>{option.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>プレビュー</h2>
        <div className={styles.preview}>
          <div
            className={styles.hossiiPreview}
            style={{
              filter: `hue-rotate(${getHueRotation(settings.hossiiColor)}deg)`,
            }}
          >
            🐟
          </div>
          <p className={styles.previewLabel}>
            選択中: {selectedColor?.label}
          </p>
        </div>
      </section>

      {/* ---- キャラクター画像 ---- */}
      {onUpdateSpace && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>キャラクター画像</h2>
          <p className={styles.description}>
            スペースに表示されるキャラクターの画像を差し替えられます
          </p>

          {space?.characterImageUrl ? (
            <div className={styles.characterPreviewArea}>
              <div className={styles.characterImageWrapper}>
                <img
                  src={space.characterImageUrl}
                  alt="キャラクター画像"
                  className={styles.characterImage}
                />
              </div>
              <button
                type="button"
                className={styles.removeImageButton}
                onClick={handleRemoveCharacter}
              >
                <X size={14} />
                削除してデフォルトに戻す
              </button>
            </div>
          ) : (
            <div
              className={`${styles.uploadArea} ${isDragging ? styles.uploadAreaDragging : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleCharacterDrop}
            >
              <Upload size={24} className={styles.uploadIcon} />
              <p className={styles.uploadText}>クリックまたはドラッグ&ドロップ</p>
              <p className={styles.uploadHint}>
                透過PNG推奨 / 最大2MB / 推奨解像度 512×512px
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className={styles.hiddenInput}
            onChange={handleCharacterInputChange}
          />

          {uploadError && (
            <p className={styles.errorText}>{uploadError}</p>
          )}
        </section>
      )}

      {/* ---- カスタム表情 ---- */}
      {onUpdateSpace && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>カスタム表情</h2>
          <p className={styles.description}>
            投稿への反応として使う表情パターンを登録できます（最大20件）
          </p>

          {customEmotions.length > 0 && (
            <div className={styles.emotionGrid}>
              {customEmotions.map((emotion) => (
                <div key={emotion.id} className={styles.emotionCard}>
                  <div className={styles.emotionImageWrapper}>
                    <img
                      src={emotion.imageUrl}
                      alt={emotion.label ?? '表情'}
                      className={styles.emotionImage}
                      style={{ width: `${emotion.width}px`, height: `${emotion.height}px` }}
                    />
                  </div>
                  {emotion.label && (
                    <p className={styles.emotionLabel}>{emotion.label}</p>
                  )}
                  <div className={styles.emotionControls}>
                    <div className={styles.sizeControl}>
                      <span className={styles.sizeLabel}>サイズ</span>
                      <input
                        type="range"
                        min={40}
                        max={200}
                        value={emotion.width}
                        onChange={(e) => handleEmotionSizeChange(emotion.id, Number(e.target.value))}
                        className={styles.sizeSlider}
                      />
                      <span className={styles.sizeValue}>{emotion.width}px</span>
                    </div>
                    <button
                      type="button"
                      className={styles.deleteEmotionButton}
                      onClick={() => handleDeleteEmotion(emotion.id)}
                      title="削除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!showEmotionEditor ? (
            <button
              type="button"
              className={styles.addEmotionButton}
              onClick={() => setShowEmotionEditor(true)}
              disabled={customEmotions.length >= 20}
            >
              <Plus size={14} />
              表情を追加
            </button>
          ) : (
            <div className={styles.emotionEditor}>
              <h3 className={styles.editorTitle}>新しい表情を追加</h3>

              <div className={styles.editorBody}>
                <div
                  className={`${styles.uploadArea} ${styles.uploadAreaSmall}`}
                  onClick={() => emotionFileInputRef.current?.click()}
                >
                  {newEmotionPreview ? (
                    <img
                      src={newEmotionPreview}
                      alt="プレビュー"
                      className={styles.emotionEditorPreview}
                    />
                  ) : (
                    <>
                      <Upload size={18} className={styles.uploadIcon} />
                      <p className={styles.uploadText}>画像を選択</p>
                    </>
                  )}
                </div>

                <input
                  ref={emotionFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className={styles.hiddenInput}
                  onChange={handleEmotionInputChange}
                />

                <input
                  type="text"
                  className={styles.emotionLabelInput}
                  placeholder="表情名（任意）例: 驚き"
                  value={newEmotionLabel}
                  onChange={(e) => setNewEmotionLabel(e.target.value)}
                  maxLength={20}
                />

                {emotionUploadError && (
                  <p className={styles.errorText}>{emotionUploadError}</p>
                )}
              </div>

              <div className={styles.editorActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => {
                    setShowEmotionEditor(false);
                    setNewEmotionPreview(null);
                    setNewEmotionLabel('');
                    setEmotionUploadError(null);
                  }}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  className={styles.saveEmotionButton}
                  onClick={handleAddEmotion}
                  disabled={!newEmotionPreview}
                >
                  追加する
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

const getHueRotation = (color: HossiiColor): number => {
  switch (color) {
    case 'pink':
      return 0;
    case 'blue':
      return 180;
    case 'yellow':
      return 45;
    case 'green':
      return 120;
    case 'purple':
      return 270;
    default:
      return 0;
  }
};
