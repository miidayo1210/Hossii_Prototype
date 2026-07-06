import { useCallback, useEffect, useState } from 'react';
import type { AppUser } from '../../core/contexts/AuthContext';
import {
  HOSSII_BASIC_PRESETS,
  getHossiiPresetByKey,
  resolveHossiiPresetImagePath,
} from '../../core/assets/hossiiPresets';
import {
  fetchMyHossiiSettings,
  saveMyHossiiPreset,
  type MyHossiiSettings,
} from '../../core/utils/userProfilesApi';
import styles from './MyHossiiSettingsSection.module.css';

type Props = {
  currentUser: AppUser | null;
};

const LOAD_ERROR_MESSAGE =
  'マイHossiiの設定を読み込めませんでした。時間をおいて、もう一度お試しください。';

export const MyHossiiSettingsSection = ({ currentUser }: Props) => {
  const [savedSettings, setSavedSettings] = useState<MyHossiiSettings | null>(null);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(() => currentUser !== null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadSettings = useCallback(async (userId: string) => {
    setIsLoading(true);
    setLoadError(null);
    setSaveError(null);
    try {
      const settings = await fetchMyHossiiSettings(userId);
      setSavedSettings(settings);
      setSelectedPresetKey(settings.presetKey);
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
      setLoadError(null);
      setSaveError(null);
      setSaveSuccess(false);
      setIsLoading(false);
      return;
    }
    void loadSettings(currentUser.uid);
  }, [currentUser, loadSettings]);

  const handleSave = async () => {
    if (!currentUser || !selectedPresetKey || isSaving) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const saved = await saveMyHossiiPreset(currentUser.uid, selectedPresetKey);
      setSavedSettings(saved);
      setSelectedPresetKey(saved.presetKey);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('[MyHossiiSettingsSection] save error:', error);
      setSaveError('保存に失敗しました。もう一度お試しください。');
    } finally {
      setIsSaving(false);
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

  const isRegistered = savedSettings?.sourceType === 'preset' && !!savedSettings.presetKey;
  const previewKey = selectedPresetKey ?? savedSettings?.presetKey;
  const previewImage = resolveHossiiPresetImagePath(previewKey);
  const previewLabel = previewKey ? getHossiiPresetByKey(previewKey)?.label : null;
  const hasChanges = selectedPresetKey !== savedSettings?.presetKey;
  const canSave = !!selectedPresetKey && hasChanges && !isSaving;

  return (
    <div className={styles.myHossiiSection}>
      {!isRegistered && (
        <div className={styles.promptCard} role="status">
          <p className={styles.promptTitle}>あなたのHossiiをこの場所に登場させよう</p>
          <p className={styles.promptDesc}>
            基本のHossiiから1体選んで登録できます。登録後は参加しているスペースに表示されます。
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
          const isSelected = selectedPresetKey === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`${styles.presetOption} ${isSelected ? styles.presetOptionSelected : ''}`}
              onClick={() => {
                setSelectedPresetKey(preset.key);
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

      <div className={styles.comingSoonRow}>
        <button type="button" className={styles.comingSoonButton} disabled aria-disabled="true">
          画像から登録
          <span className={styles.comingSoonBadge}>Coming soon</span>
        </button>
        <button type="button" className={styles.comingSoonButton} disabled aria-disabled="true">
          カスタムして作る
          <span className={styles.comingSoonBadge}>Coming soon</span>
        </button>
      </div>

      <div className={styles.actionsRow}>
        <button
          type="button"
          className={styles.saveButton}
          onClick={() => void handleSave()}
          disabled={!canSave}
          aria-busy={isSaving}
        >
          {isSaving ? '保存中...' : saveSuccess ? '保存済み ✓' : '保存'}
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
