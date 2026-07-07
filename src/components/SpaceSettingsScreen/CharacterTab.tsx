import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, X, Plus, Trash2 } from 'lucide-react';
import { generateId } from '../../core/utils';
import type { Space, CustomEmotion } from '../../core/types/space';
import type { MyHossiiLogVisibility, MyHossiiMotionMode } from '../../core/types/myHossii';
import {
  DEFAULT_MY_HOSSII_LOG_VISIBILITY,
  DEFAULT_MY_HOSSII_MOTION_MODE,
} from '../../core/types/myHossii';
import { resolvePaneCharacter } from '../../core/utils/resolvePaneCharacter';
import {
  hasPaneColumnOverride,
  isAdditionalPane,
} from '../../core/utils/paneOverrideFields';
import {
  PaneOverrideSaveError,
  resetPaneCharacterOverride,
  savePaneCharacterOverride,
} from '../../core/utils/savePaneSettingOverride';
import { useScreenDraft } from '../../core/hooks/useScreenDraft';
import { useSettingsEditPane } from './SettingsEditPaneContext';
import { PaneOverrideHint } from './PaneOverrideHint';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsSection } from './SettingsSection';
import { SettingsSaveBar } from './SettingsSaveBar';
import sharedStyles from './SettingsShared.module.css';
import formStyles from './GeneralTab.module.css';
import styles from './HossiiCustomTab.module.css';

type CharacterDraft = {
  characterName: string;
  characterImageUrl?: string;
  customEmotions: CustomEmotion[];
  myHossiiEnabled: boolean;
  myHossiiMotionMode: MyHossiiMotionMode;
  myHossiiLogVisibility: MyHossiiLogVisibility;
};

type Props = {
  space: Space;
  onUpdateSpace: (patch: Partial<Space>) => void;
  onDirtyChange: (dirty: boolean) => void;
};

const MAX_FILE_SIZE = 2 * 1024 * 1024;

function buildInitialDraft(space: Space, editPane: ReturnType<typeof useSettingsEditPane>['editPane']): CharacterDraft {
  const resolved = resolvePaneCharacter(editPane, space);
  return {
    characterName: resolved.characterName ?? '',
    characterImageUrl: resolved.characterImageUrl,
    customEmotions: resolved.customEmotions,
    myHossiiEnabled: space.myHossiiEnabled ?? false,
    myHossiiMotionMode: space.myHossiiMotionMode ?? DEFAULT_MY_HOSSII_MOTION_MODE,
    myHossiiLogVisibility: space.myHossiiLogVisibility ?? DEFAULT_MY_HOSSII_LOG_VISIBILITY,
  };
}

export const CharacterTab = ({ space, onUpdateSpace, onDirtyChange }: Props) => {
  const { editPane, saveContext } = useSettingsEditPane();
  const initial = useMemo(() => buildInitialDraft(space, editPane), [space, editPane]);
  const { draft, setDraft, isDirty, discard, commitSaved } = useScreenDraft(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emotionFileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showEmotionEditor, setShowEmotionEditor] = useState(false);
  const [newEmotionLabel, setNewEmotionLabel] = useState('');
  const [newEmotionPreview, setNewEmotionPreview] = useState<string | null>(null);
  const [emotionUploadError, setEmotionUploadError] = useState<string | null>(null);

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const hasOverride =
    editPane != null &&
    isAdditionalPane(editPane) &&
    (hasPaneColumnOverride(editPane, 'characterName') ||
      hasPaneColumnOverride(editPane, 'characterImageUrl') ||
      hasPaneColumnOverride(editPane, 'customEmotions'));

  const processImageFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
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

  const handleSave = async () => {
    if (!saveContext) return;
    setIsSaving(true);
    try {
      await savePaneCharacterOverride(saveContext, {
        characterName: draft.characterName,
        characterImageUrl: draft.characterImageUrl,
        customEmotions: draft.customEmotions,
        myHossiiEnabled: draft.myHossiiEnabled,
        myHossiiMotionMode: draft.myHossiiMotionMode,
        myHossiiLogVisibility: draft.myHossiiLogVisibility,
      });
      if (saveContext.editPane.isDefault) {
        onUpdateSpace({
          characterName: draft.characterName || undefined,
          characterImageUrl: draft.characterImageUrl,
          customEmotions: draft.customEmotions,
          myHossiiEnabled: draft.myHossiiEnabled,
          myHossiiMotionMode: draft.myHossiiMotionMode,
          myHossiiLogVisibility: draft.myHossiiLogVisibility,
        });
      }
      commitSaved();
      setToast({ message: '保存しました', type: 'success' });
    } catch (err) {
      console.error('[CharacterTab] save failed', err);
      const message =
        err instanceof PaneOverrideSaveError
          ? err.message
          : '保存に失敗しました';
      setToast({ message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!saveContext || !editPane || !isAdditionalPane(editPane)) return;
    setIsSaving(true);
    try {
      await resetPaneCharacterOverride(saveContext);
      const next = buildInitialDraft(space, {
        ...editPane,
        characterName: null,
        characterImageUrl: null,
        customEmotions: null,
      });
      commitSaved(next);
      setToast({ message: 'Space 設定に戻しました', type: 'success' });
    } catch (err) {
      console.error('[CharacterTab] reset failed', err);
      setToast({ message: 'リセットに失敗しました', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <SettingsPageHeader
        title="中心キャラクター"
        description="スペース中央に表示されるキャラクターの見た目と表情を設定します。"
      >
        {editPane && isAdditionalPane(editPane) && (
          <PaneOverrideHint hasOverride={hasOverride} onReset={handleReset} />
        )}
        <SettingsSection title="キャラクター名">
          <input
            type="text"
            className={formStyles.nameInput}
            value={draft.characterName}
            onChange={(e) => setDraft({ ...draft, characterName: e.target.value })}
            placeholder="例: Hossii"
            maxLength={30}
          />
        </SettingsSection>

        <SettingsSection title="キャラクター画像" description="スペースに表示されるキャラクターの画像を差し替えられます">
          {draft.characterImageUrl ? (
            <div className={styles.characterPreviewArea}>
              <div className={styles.characterImageWrapper}>
                <img src={draft.characterImageUrl} alt="キャラクター画像" className={styles.characterImage} />
              </div>
              <button
                type="button"
                className={styles.removeImageButton}
                onClick={() => setDraft({ ...draft, characterImageUrl: undefined })}
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
              onDrop={async (e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (!file) return;
                try {
                  const dataUrl = await processImageFile(file);
                  setDraft({ ...draft, characterImageUrl: dataUrl });
                  setUploadError(null);
                } catch (err) {
                  setUploadError(err instanceof Error ? err.message : 'アップロードに失敗しました');
                }
              }}
            >
              <Upload size={24} className={styles.uploadIcon} />
              <p className={styles.uploadText}>クリックまたはドラッグ&ドロップ</p>
              <p className={styles.uploadHint}>透過PNG推奨 / 最大2MB / 推奨解像度 512×512px</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className={styles.hiddenInput}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                const dataUrl = await processImageFile(file);
                setDraft({ ...draft, characterImageUrl: dataUrl });
                setUploadError(null);
              } catch (err) {
                setUploadError(err instanceof Error ? err.message : 'アップロードに失敗しました');
              }
            }}
          />
          {uploadError && <p className={styles.errorText}>{uploadError}</p>}
        </SettingsSection>

        <SettingsSection
          title="マイHossiiを表示"
          description="参加者が登録したマイHossiiを、スペースの景色に登場させます。OFFのときはスペースHossiiのみ表示されます。"
        >
          <label className={styles.myHossiiToggle}>
            <input
              type="checkbox"
              checked={draft.myHossiiEnabled}
              onChange={(e) => setDraft({ ...draft, myHossiiEnabled: e.target.checked })}
            />
            <span>マイHossiiを表示する</span>
          </label>

          {draft.myHossiiEnabled && (
            <div className={styles.myHossiiOptions}>
              <label className={styles.optionLabel}>
                動き方
                <select
                  className={formStyles.nameInput}
                  value={draft.myHossiiMotionMode}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      myHossiiMotionMode: e.target.value as MyHossiiMotionMode,
                    })
                  }
                >
                  <option value="auto">自動（投稿量・人数に応じて調整）</option>
                  <option value="free">自由に浮遊</option>
                  <option value="anchored">基本位置を固定して揺れる</option>
                </select>
              </label>

              <label className={styles.optionLabel}>
                ログ公開範囲
                <select
                  className={formStyles.nameInput}
                  value={draft.myHossiiLogVisibility}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      myHossiiLogVisibility: e.target.value as MyHossiiLogVisibility,
                    })
                  }
                >
                  <option value="public">全員（ゲスト含む）</option>
                  <option value="authenticated">ログインユーザーのみ</option>
                  <option value="hidden">誰にも表示しない</option>
                </select>
              </label>
            </div>
          )}
        </SettingsSection>

        <SettingsSection title="表情" description="投稿への反応として使う表情パターンを登録できます（最大20件）">
          {draft.customEmotions.length > 0 && (
            <div className={styles.emotionGrid}>
              {draft.customEmotions.map((emotion) => (
                <div key={emotion.id} className={styles.emotionCard}>
                  <div className={styles.emotionImageWrapper}>
                    <img
                      src={emotion.imageUrl}
                      alt={emotion.label ?? '表情'}
                      className={styles.emotionImage}
                      style={{ width: `${emotion.width}px`, height: `${emotion.height}px` }}
                    />
                  </div>
                  {emotion.label && <p className={styles.emotionLabel}>{emotion.label}</p>}
                  <div className={styles.emotionControls}>
                    <div className={styles.sizeControl}>
                      <span className={styles.sizeLabel}>サイズ</span>
                      <input
                        type="range"
                        min={40}
                        max={200}
                        value={emotion.width}
                        onChange={(e) => {
                          const size = Number(e.target.value);
                          setDraft({
                            ...draft,
                            customEmotions: draft.customEmotions.map((item) =>
                              item.id === emotion.id ? { ...item, width: size, height: size } : item,
                            ),
                          });
                        }}
                        className={styles.sizeSlider}
                      />
                      <span className={styles.sizeValue}>{emotion.width}px</span>
                    </div>
                    <button
                      type="button"
                      className={styles.deleteEmotionButton}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          customEmotions: draft.customEmotions.filter((item) => item.id !== emotion.id),
                        })
                      }
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!showEmotionEditor ? (
            <button type="button" className={styles.addEmotionButton} onClick={() => setShowEmotionEditor(true)}>
              <Plus size={16} />
              表情を追加
            </button>
          ) : (
            <div className={styles.emotionEditor}>
              <p className={styles.editorTitle}>表情を追加</p>
              <div className={styles.editorBody}>
                {newEmotionPreview ? (
                  <img src={newEmotionPreview} alt="プレビュー" className={styles.emotionEditorPreview} />
                ) : (
                  <button type="button" className={`${styles.uploadArea} ${styles.uploadAreaSmall}`} onClick={() => emotionFileInputRef.current?.click()}>
                    <Upload size={16} className={styles.uploadIcon} />
                    <span className={styles.uploadText}>画像を選択</span>
                  </button>
                )}
                <input
                  ref={emotionFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className={styles.hiddenInput}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    try {
                      setNewEmotionPreview(await processImageFile(file));
                      setEmotionUploadError(null);
                    } catch (err) {
                      setEmotionUploadError(err instanceof Error ? err.message : 'アップロードに失敗しました');
                    }
                  }}
                />
                <input
                  type="text"
                  className={styles.emotionLabelInput}
                  value={newEmotionLabel}
                  onChange={(e) => setNewEmotionLabel(e.target.value)}
                  placeholder="ラベル（任意）"
                />
              </div>
              {emotionUploadError && <p className={styles.errorText}>{emotionUploadError}</p>}
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
                  onClick={() => {
                    if (!newEmotionPreview) {
                      setEmotionUploadError('画像を選択してください');
                      return;
                    }
                    if (draft.customEmotions.length >= 20) {
                      setEmotionUploadError('表情は最大20件まで登録できます');
                      return;
                    }
                    setDraft({
                      ...draft,
                      customEmotions: [
                        ...draft.customEmotions,
                        {
                          id: generateId(),
                          label: newEmotionLabel.trim() || undefined,
                          imageUrl: newEmotionPreview,
                          width: 80,
                          height: 80,
                        },
                      ],
                    });
                    setShowEmotionEditor(false);
                    setNewEmotionPreview(null);
                    setNewEmotionLabel('');
                    setEmotionUploadError(null);
                  }}
                >
                  追加
                </button>
              </div>
            </div>
          )}
        </SettingsSection>

        <SettingsSaveBar isDirty={isDirty} isSaving={isSaving} onDiscard={discard} onSave={handleSave} />
      </SettingsPageHeader>

      {toast && (
        <div className={`${sharedStyles.toast} ${toast.type === 'success' ? sharedStyles.toastSuccess : sharedStyles.toastError}`}>
          {toast.message}
        </div>
      )}
    </>
  );
};
