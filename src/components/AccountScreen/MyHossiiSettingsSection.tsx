import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppUser } from '../../core/contexts/AuthContext';
import {
  HOSSII_BASIC_PRESETS,
  getHossiiPresetByKey,
  resolveHossiiPresetImagePath,
} from '../../core/assets/hossiiPresets';
import { resolveMyHossiiImage } from '../../core/utils/resolveMyHossiiImage';
import {
  fetchMyHossiiSettings,
  isMyHossiiRegistered,
  saveMyHossiiPreset,
  saveMyHossiiUpload,
  type MyHossiiSettings,
} from '../../core/utils/userProfilesApi';
import styles from './MyHossiiSettingsSection.module.css';

type Props = {
  currentUser: AppUser | null;
};

const LOAD_ERROR_MESSAGE =
  'マイHossiiの設定を読み込めませんでした。時間をおいて、もう一度お試しください。';

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export const MyHossiiSettingsSection = ({ currentUser }: Props) => {
  const [savedSettings, setSavedSettings] = useState<MyHossiiSettings | null>(null);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(() => currentUser !== null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSettings = useCallback(async (userId: string) => {
    setIsLoading(true);
    setLoadError(null);
    setSaveError(null);
    try {
      const settings = await fetchMyHossiiSettings(userId);
      setSavedSettings(settings);
      setSelectedPresetKey(settings.sourceType === 'preset' ? settings.presetKey : null);
      setUploadPreviewUrl(null);
      setPendingUploadFile(null);
    } catch (error) {
      console.error('[MyHossiiSettingsSection] load error:', error);
      setLoadError(LOAD_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setSavedSettings(null);
      setSelectedPresetKey(null);
      setUploadPreviewUrl(null);
      setPendingUploadFile(null);
      setLoadError(null);
      setSaveError(null);
      setSaveSuccess(false);
      setIsLoading(false);
      return;
    }
    void loadSettings(currentUser.uid);
  }, [currentUser, loadSettings]);

  const handleSavePreset = async () => {
    if (!currentUser || !selectedPresetKey || isSaving) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const saved = await saveMyHossiiPreset(currentUser.uid, selectedPresetKey);
      setSavedSettings(saved);
      setSelectedPresetKey(saved.presetKey);
      setUploadPreviewUrl(null);
      setPendingUploadFile(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('[MyHossiiSettingsSection] save error:', error);
      setSaveError('保存に失敗しました。もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setSaveError('画像ファイルを選択してください');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setSaveError('ファイルサイズが2MBを超えています');
      return;
    }
    setSaveError(null);
    setPendingUploadFile(file);
    setUploadPreviewUrl(URL.createObjectURL(file));
    setSelectedPresetKey(null);
  };

  const handleUploadSave = async () => {
    if (!currentUser || !pendingUploadFile || isUploading) return;

    setIsUploading(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const saved = await saveMyHossiiUpload(currentUser.uid, pendingUploadFile);
      setSavedSettings(saved);
      setPendingUploadFile(null);
      setUploadPreviewUrl(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('[MyHossiiSettingsSection] upload error:', error);
      setSaveError(error instanceof Error ? error.message : 'アップロードに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelUpload = () => {
    setPendingUploadFile(null);
    setUploadPreviewUrl(null);
    if (savedSettings?.sourceType === 'preset') {
      setSelectedPresetKey(savedSettings.presetKey);
    }
  };

  if (!currentUser) {
    return (
      <div className={styles.myHossiiSection}>
        <p className={styles.guestNotice}>
          マイHossiiはログインアカウントで利用できます。ログイン後に、あなたのHossiiを登録できます。
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.myHossiiSection}>
        <p className={styles.loadingText}>読み込み中...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.myHossiiSection}>
        <p className={`${styles.statusMessage} ${styles.statusError}`} role="alert">
          {loadError}
        </p>
        <button
          type="button"
          className={styles.saveButton}
          onClick={() => void loadSettings(currentUser.uid)}
        >
          再読み込み
        </button>
      </div>
    );
  }

  const isRegistered = savedSettings ? isMyHossiiRegistered(savedSettings) : false;

  const previewImage = (() => {
    if (uploadPreviewUrl) return uploadPreviewUrl;
    if (savedSettings?.sourceType === 'upload' && savedSettings.imagePath) {
      return resolveMyHossiiImage({
        hossiiSourceType: 'upload',
        hossiiPresetKey: null,
        hossiiImagePath: savedSettings.imagePath,
      });
    }
    const previewKey = selectedPresetKey ?? savedSettings?.presetKey;
    return resolveHossiiPresetImagePath(previewKey);
  })();

  const previewLabel = (() => {
    if (pendingUploadFile) return '画像プレビュー';
    if (savedSettings?.sourceType === 'upload') return 'アップロード画像';
    const previewKey = selectedPresetKey ?? savedSettings?.presetKey;
    return previewKey ? getHossiiPresetByKey(previewKey)?.label : null;
  })();

  const hasPresetChanges =
    !!selectedPresetKey && selectedPresetKey !== savedSettings?.presetKey;
  const canSavePreset = hasPresetChanges && !isSaving && !isUploading;
  const canSaveUpload = !!pendingUploadFile && !isUploading && !isSaving;

  return (
    <div className={styles.myHossiiSection}>
      {!isRegistered && (
        <div className={styles.promptCard} role="status">
          <p className={styles.promptTitle}>あなたのHossiiをこの場所に登場させよう</p>
          <p className={styles.promptDesc}>
            基本のHossiiから1体選ぶか、画像を登録できます。登録後は参加しているスペースに表示されます。
          </p>
        </div>
      )}

      <div className={styles.currentPreview} aria-live="polite">
        {previewImage ? (
          <img
            src={previewImage}
            alt={previewLabel ? `現在のマイHossii: ${previewLabel}` : '現在のマイHossii'}
            className={styles.currentPreviewImage}
          />
        ) : (
          <div className={styles.currentPreviewPlaceholder} aria-hidden="true">
            未登録
          </div>
        )}
        <div className={styles.currentPreviewText}>
          <p className={styles.currentLabel}>現在のマイHossii</p>
          <p className={styles.currentName}>
            {previewLabel ?? 'まだ登録されていません'}
          </p>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="基本Hossiiプリセット"
        className={styles.presetGrid}
      >
        {HOSSII_BASIC_PRESETS.map((preset) => {
          const isSelected = selectedPresetKey === preset.key && !pendingUploadFile;
          return (
            <button
              key={preset.key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`${styles.presetOption} ${isSelected ? styles.presetOptionSelected : ''}`}
              onClick={() => {
                setSelectedPresetKey(preset.key);
                setPendingUploadFile(null);
                setUploadPreviewUrl(null);
                setSaveError(null);
              }}
            >
              <img
                src={preset.imagePath}
                alt=""
                aria-hidden="true"
                className={styles.presetImage}
              />
              <span className={styles.presetLabel}>{preset.label}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.uploadRow}>
        <button
          type="button"
          className={styles.uploadButton}
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          画像から登録
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className={styles.hiddenInput}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) handleFileSelect(file);
          }}
        />
        {pendingUploadFile && (
          <div className={styles.uploadActions}>
            <button
              type="button"
              className={styles.saveButton}
              onClick={() => void handleUploadSave()}
              disabled={!canSaveUpload}
              aria-busy={isUploading}
            >
              {isUploading ? 'アップロード中...' : '画像を保存'}
            </button>
            <button type="button" className={styles.cancelButton} onClick={handleCancelUpload}>
              キャンセル
            </button>
          </div>
        )}
      </div>

      <div className={styles.comingSoonRow}>
        <button type="button" className={styles.comingSoonButton} disabled aria-disabled="true">
          カスタムして作る
          <span className={styles.comingSoonBadge}>Coming soon</span>
        </button>
      </div>

      <div className={styles.actionsRow}>
        <button
          type="button"
          className={styles.saveButton}
          onClick={() => void handleSavePreset()}
          disabled={!canSavePreset}
          aria-busy={isSaving}
        >
          {isSaving ? '保存中...' : saveSuccess && !pendingUploadFile ? '保存済み ✓' : 'プリセットを保存'}
        </button>
        {saveSuccess && (
          <p className={`${styles.statusMessage} ${styles.statusSuccess}`} role="status">
            マイHossiiを登録しました
          </p>
        )}
        {saveError && (
          <p className={`${styles.statusMessage} ${styles.statusError}`} role="alert">
            {saveError}
          </p>
        )}
      </div>
    </div>
  );
};
