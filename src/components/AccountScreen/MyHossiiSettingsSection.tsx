import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppUser } from '../../core/contexts/AuthContext';
import {
  HOSSII_BASIC_PRESETS,
  getHossiiPresetByKey,
  resolveHossiiPresetImagePath,
} from '../../core/assets/hossiiPresets';
import {
  buildMyHossiiSpaceAppearanceInput,
  getRegistrationSuccessMessage,
  isAdminUser,
  isVisibleInSpace,
  resolveMyHossiiAccountUiState,
  type MyHossiiSpaceAppearanceInput,
  type ParticipantEligibility,
  type ParticipantEligibilityReason,
} from '../../core/utils/myHossiiAppearance';
import {
  fetchParticipantEligibilityResult,
  getParticipantEligibilityAppearanceMessage,
} from '../../core/utils/myHossiiParticipationApi';
import {
  fetchMyHossiiSpacePreference,
  upsertMyHossiiSpacePreference,
} from '../../core/utils/myHossiiSpacePreferencesApi';
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
  activeSpaceId?: string | null;
  activeSpaceName?: string | null;
  spaceMyHossiiEnabled?: boolean;
  deviceProfileId?: string | null;
  defaultNickname?: string | null;
  /** ニックネーム保存後など、登場状態を再取得するトリガー */
  refreshKey?: number;
};

const LOAD_ERROR_MESSAGE =
  'マイHossiiの設定を読み込めませんでした。時間をおいて、もう一度お試しください。';

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export const MyHossiiSettingsSection = ({
  currentUser,
  activeSpaceId,
  activeSpaceName,
  spaceMyHossiiEnabled = false,
  deviceProfileId,
  defaultNickname,
  refreshKey = 0,
}: Props) => {
  const [savedSettings, setSavedSettings] = useState<MyHossiiSettings | null>(null);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(() => currentUser !== null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(null);
  const [participantEligibility, setParticipantEligibility] =
    useState<ParticipantEligibility>('not_participant');
  const [participantReason, setParticipantReason] =
    useState<ParticipantEligibilityReason>('no_space_nickname');
  const [userPreferenceVisible, setUserPreferenceVisible] = useState(true);
  const [isAppearanceLoading, setIsAppearanceLoading] = useState(false);
  const [appearanceError, setAppearanceError] = useState<string | null>(null);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAppearance = useCallback(
    async (userId: string, spaceId: string | null | undefined, settings: MyHossiiSettings) => {
      if (!spaceId) {
        setParticipantEligibility('not_participant');
        setParticipantReason('no_space_nickname');
        setUserPreferenceVisible(true);
        return buildMyHossiiSpaceAppearanceInput({
          myHossiiSettings: settings,
          spaceMyHossiiEnabled: false,
          participantEligibility: 'not_participant',
          participantReason: 'no_space_nickname',
          userPreferenceVisible: true,
        });
      }

      setIsAppearanceLoading(true);
      setAppearanceError(null);
      try {
        const [eligibilityResult, preferenceVisible] = await Promise.all([
          fetchParticipantEligibilityResult(userId, spaceId, {
            legacyProfileId: deviceProfileId,
            defaultNickname,
          }),
          fetchMyHossiiSpacePreference(userId, spaceId),
        ]);
        setParticipantEligibility(eligibilityResult.eligibility);
        setParticipantReason(eligibilityResult.reason);
        setUserPreferenceVisible(preferenceVisible);
        return buildMyHossiiSpaceAppearanceInput({
          myHossiiSettings: settings,
          spaceMyHossiiEnabled,
          participantEligibility: eligibilityResult.eligibility,
          participantReason: eligibilityResult.reason,
          userPreferenceVisible: preferenceVisible,
        });
      } catch (error) {
        console.error('[MyHossiiSettingsSection] appearance load error:', error);
        setParticipantEligibility('error');
        setParticipantReason('error');
        setAppearanceError(
          'このスペースでの登場状態を確認できませんでした。時間をおいて、もう一度お試しください。',
        );
        return buildMyHossiiSpaceAppearanceInput({
          myHossiiSettings: settings,
          spaceMyHossiiEnabled,
          participantEligibility: 'error',
          participantReason: 'error',
          userPreferenceVisible: true,
        });
      } finally {
        setIsAppearanceLoading(false);
      }
    },
    [spaceMyHossiiEnabled, deviceProfileId, defaultNickname],
  );

  const loadSettings = useCallback(async () => {
    if (!currentUser) return;

    setIsLoading(true);
    setLoadError(null);
    setSaveError(null);
    try {
      const settings = await fetchMyHossiiSettings(currentUser.uid);
      setSavedSettings(settings);
      setSelectedPresetKey(settings.sourceType === 'preset' ? settings.presetKey : null);
      setUploadPreviewUrl(null);
      setPendingUploadFile(null);
      await loadAppearance(currentUser.uid, activeSpaceId, settings);
    } catch (error) {
      console.error('[MyHossiiSettingsSection] load error:', error);
      setLoadError(LOAD_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, activeSpaceId, loadAppearance]);

  useEffect(() => {
    if (!currentUser) {
      setSavedSettings(null);
      setSelectedPresetKey(null);
      setUploadPreviewUrl(null);
      setPendingUploadFile(null);
      setLoadError(null);
      setSaveError(null);
      setRegistrationMessage(null);
      setIsLoading(false);
      return;
    }
    void loadSettings();
  }, [currentUser, refreshKey, loadSettings]);

  const handleRegistrationComplete = async (saved: MyHossiiSettings) => {
    if (!currentUser) return;
    const appearance = await loadAppearance(currentUser.uid, activeSpaceId, saved);
    setRegistrationMessage(getRegistrationSuccessMessage(appearance, activeSpaceName));
  };

  const handleSavePreset = async () => {
    if (!currentUser || !selectedPresetKey || isSaving) return;

    setIsSaving(true);
    setSaveError(null);
    setRegistrationMessage(null);

    try {
      const saved = await saveMyHossiiPreset(currentUser.uid, selectedPresetKey);
      setSavedSettings(saved);
      setSelectedPresetKey(saved.presetKey);
      setUploadPreviewUrl(null);
      setPendingUploadFile(null);
      await handleRegistrationComplete(saved);
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
    setSaveError(null);
    setRegistrationMessage(null);

    try {
      const saved = await saveMyHossiiUpload(currentUser.uid, pendingUploadFile);
      setSavedSettings(saved);
      setPendingUploadFile(null);
      setUploadPreviewUrl(null);
      await handleRegistrationComplete(saved);
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

  const handleVisibilityToggle = async (nextVisible: boolean) => {
    if (!currentUser || !activeSpaceId || isTogglingVisibility) return;

    setIsTogglingVisibility(true);
    setAppearanceError(null);
    try {
      await upsertMyHossiiSpacePreference(currentUser.uid, activeSpaceId, nextVisible);
      setUserPreferenceVisible(nextVisible);
      setRegistrationMessage(null);
    } catch (error) {
      console.error('[MyHossiiSettingsSection] visibility toggle error:', error);
      setAppearanceError('登場設定の保存に失敗しました。');
    } finally {
      setIsTogglingVisibility(false);
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
          onClick={() => void loadSettings()}
        >
          再読み込み
        </button>
      </div>
    );
  }

  const appearanceInput: MyHossiiSpaceAppearanceInput = buildMyHossiiSpaceAppearanceInput({
    myHossiiSettings: savedSettings ?? {
      sourceType: null,
      presetKey: null,
      imagePath: null,
      updatedAt: null,
    },
    spaceMyHossiiEnabled,
    participantEligibility,
    participantReason,
    userPreferenceVisible,
  });

  const uiState = resolveMyHossiiAccountUiState(appearanceInput);
  const isRegistered = savedSettings ? isMyHossiiRegistered(savedSettings) : false;
  const currentlyVisible = isVisibleInSpace(appearanceInput);
  const participationMessage = getParticipantEligibilityAppearanceMessage(
    { eligibility: participantEligibility, reason: participantReason },
    isAdminUser(currentUser),
  );

  const previewImage = (() => {
    if (uploadPreviewUrl) return uploadPreviewUrl;
    if (savedSettings?.sourceType === 'upload' && savedSettings.imagePath) {
      return resolveMyHossiiImage({
        userId: currentUser.uid,
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
  const canToggleVisibility =
    uiState === 'registered_visible' || uiState === 'registered_hidden_by_user';

  return (
    <div className={styles.myHossiiSection}>
      {!isRegistered && (
        <div className={styles.promptCard} role="status">
          <p className={styles.promptTitle}>あなたのHossiiを登場させよう</p>
          <p className={styles.promptDesc}>
            マイHossiiを登録すると、参加しているスペースに登場できます。
          </p>
        </div>
      )}

      {activeSpaceId && (
        <div className={styles.appearanceCard} aria-live="polite">
          <p className={styles.appearanceTitle}>
            {activeSpaceName ? `${activeSpaceName}での登場` : 'このスペースでの登場'}
          </p>

          {isAppearanceLoading ? (
            <p className={styles.appearanceDesc}>登場状態を確認しています...</p>
          ) : (
            <>
              {uiState === 'unregistered' && (
                <p className={styles.appearanceDesc}>
                  マイHossiiを登録すると、参加しているスペースに登場できます。
                </p>
              )}

              {uiState === 'registered_visible' && (
                <>
                  <label className={styles.visibilityToggle}>
                    <span>このスペースにマイHossiiを登場させる</span>
                    <input
                      type="checkbox"
                      checked={userPreferenceVisible}
                      disabled={isTogglingVisibility}
                      onChange={(e) => void handleVisibilityToggle(e.target.checked)}
                    />
                    <span className={styles.toggleLabel}>{userPreferenceVisible ? 'ON' : 'OFF'}</span>
                  </label>
                  <p className={`${styles.appearanceStatus} ${styles.appearanceStatusPositive}`}>
                    このスペースに登場しています。
                  </p>
                </>
              )}

              {uiState === 'registered_hidden_by_user' && (
                <>
                  <label className={styles.visibilityToggle}>
                    <span>このスペースにマイHossiiを登場させる</span>
                    <input
                      type="checkbox"
                      checked={userPreferenceVisible}
                      disabled={isTogglingVisibility}
                      onChange={(e) => void handleVisibilityToggle(e.target.checked)}
                    />
                    <span className={styles.toggleLabel}>{userPreferenceVisible ? 'ON' : 'OFF'}</span>
                  </label>
                  <p className={styles.appearanceStatus}>
                    マイHossiiは登録されていますが、このスペースでは非表示です。
                  </p>
                </>
              )}

              {uiState === 'registered_space_off' && (
                <p className={styles.appearanceStatus}>
                  マイHossiiは登録されています。
                  <br />
                  このスペースでは、現在マイHossii機能が有効になっていません。
                  管理者が機能をONにすると登場できます。
                </p>
              )}

              {uiState === 'registered_not_participant' && participationMessage && (
                <p className={styles.appearanceStatus}>
                  {participationMessage.split('\n').map((line, index, lines) => (
                    <span key={`${line}-${index}`}>
                      {line}
                      {index < lines.length - 1 && <br />}
                    </span>
                  ))}
                </p>
              )}

              {uiState === 'registered_appearance_error' && (
                <p className={`${styles.appearanceStatus} ${styles.statusError}`} role="alert">
                  {appearanceError ??
                    'このスペースでの登場状態を確認できませんでした。時間をおいて、もう一度お試しください。'}
                </p>
              )}

              {uiState === 'registered_revoked' && (
                <p className={styles.appearanceStatus}>
                  現在、このスペースではマイHossiiを登場させることができません。
                </p>
              )}

              {appearanceError && uiState !== 'registered_appearance_error' && (
                <p className={`${styles.statusMessage} ${styles.statusError}`} role="alert">
                  {appearanceError}
                </p>
              )}

              {canToggleVisibility && currentlyVisible && (
                <p className={styles.appearanceHint}>
                  OFFにすると、このスペースのHOMEからマイHossiiが消えます。登録内容は維持されます。
                </p>
              )}
            </>
          )}
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
          {isSaving ? '保存中...' : 'プリセットを保存'}
        </button>
        {registrationMessage && (
          <p className={`${styles.statusMessage} ${styles.statusSuccess}`} role="status">
            {registrationMessage.split('\n').map((line, index) => (
              <span key={`${line}-${index}`}>
                {line}
                {index < registrationMessage.split('\n').length - 1 && <br />}
              </span>
            ))}
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
