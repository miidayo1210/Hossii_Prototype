import { useEffect, useMemo, useRef, useState } from 'react';
import type { Space, SpaceBackground } from '../../core/types/space';
import { MAX_BACKGROUND_IMAGES } from '../../core/types/space';
import type { SpacePane } from '../../core/types/spacePane';
import { useScreenDraft } from '../../core/hooks/useScreenDraft';
import { useSpacePane } from '../../core/hooks/SpacePaneProvider';
import { isSupabaseConfigured } from '../../core/supabase';
import { appendSavedBackgroundUrl } from '../../core/utils/backgroundGallery';
import {
  applyAllPanesToMain,
  applyAllPanesToPoolIndex,
  buildInitialBackgroundBoardDraft,
  describeBackground,
  describePaneAssignment,
  getAdditionalPaneIds,
  getAdditionalPanes,
  getPaneAssignment,
  poolImageBackground,
  resolveDefaultPane,
  resolveDraftPaneBackground,
  setPaneAssignment,
  type BackgroundBoardDraft,
  type PaneAssignmentSelection,
  type PoolSlotIndex,
} from '../../core/utils/backgroundBoard';
import {
  PaneOverrideSaveError,
} from '../../core/utils/savePaneSettingOverride';
import { saveBackgroundBoard } from '../../core/utils/saveBackgroundBoard';
import { uploadBackgroundImage } from '../../core/utils/imageStorageApi';
import { BackgroundSelector } from '../BackgroundSelector/BackgroundSelector';
import { BackgroundPreviewThumb } from './BackgroundPreviewThumb';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsSection } from './SettingsSection';
import { SettingsSaveBar } from './SettingsSaveBar';
import galleryStyles from '../BackgroundSelector/BackgroundSelector.module.css';
import boardStyles from './TabBackgroundBoard.module.css';
import sharedStyles from './SettingsShared.module.css';

type Props = {
  space: Space;
  panes: SpacePane[];
  onUpdateSpace: (patch: Partial<Space>) => void;
  onDirtyChange: (dirty: boolean) => void;
};

const POOL_SLOT_LABELS = Array.from(
  { length: MAX_BACKGROUND_IMAGES },
  (_, i) => `画像${i + 1}`,
);

function PaneSegmentButtons({
  pane,
  draft,
  onAssign,
}: {
  pane: SpacePane;
  draft: BackgroundBoardDraft;
  onAssign: (selection: PaneAssignmentSelection) => void;
}) {
  const pool = draft.main.savedBackgroundImages ?? [];
  const selected = getPaneAssignment(pane.id, draft);

  return (
    <div className={boardStyles.segmentGroup} role="group" aria-label={`${pane.name}の背景割り当て`}>
      <button
        type="button"
        className={`${boardStyles.segmentButton} ${selected === 'main' ? boardStyles.segmentButtonSelected : ''}`}
        aria-pressed={selected === 'main'}
        aria-label={`${pane.name}の背景: メインタブと同じ`}
        onClick={() => onAssign('main')}
      >
        同じ背景
      </button>
      {POOL_SLOT_LABELS.map((label, index) => {
        const url = pool[index];
        const slot = index as PoolSlotIndex;
        const isSelected = selected === slot;
        return (
          <button
            key={label}
            type="button"
            className={`${boardStyles.segmentButton} ${isSelected ? boardStyles.segmentButtonSelected : ''}`}
            aria-pressed={isSelected}
            aria-label={`${pane.name}の背景: ${label}`}
            disabled={!url}
            title={url ? undefined : 'メインタブの背景設定で画像を追加'}
            onClick={() => onAssign(slot)}
          >
            {url ? (
              <>
                <img src={url} alt="" className={boardStyles.segmentThumb} />
                {label}
              </>
            ) : (
              label
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabBackgroundBoard({ space, panes, onUpdateSpace, onDirtyChange }: Props) {
  const { reloadPanesAndSyncActive } = useSpacePane();
  const initial = useMemo(
    () => buildInitialBackgroundBoardDraft(space, panes),
    [space, panes],
  );
  const { draft, setDraft, isDirty, discard, commitSaved } = useScreenDraft(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isPoolUploading, setIsPoolUploading] = useState(false);
  const [poolUploadError, setPoolUploadError] = useState<string | null>(null);
  const objectURLsRef = useRef<Set<string>>(new Set());
  const poolFileInputRef = useRef<HTMLInputElement>(null);

  const defaultPane = useMemo(() => resolveDefaultPane(panes), [panes]);
  const additionalPanes = useMemo(() => getAdditionalPanes(panes), [panes]);
  const additionalPaneIds = useMemo(() => getAdditionalPaneIds(panes), [panes]);
  const pool = draft.main.savedBackgroundImages ?? [];

  useEffect(() => {
    const urls = objectURLsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const trackTempUrl = (background?: SpaceBackground) => {
    if (background?.kind === 'image' && background.source === 'temp') {
      objectURLsRef.current.add(background.value);
    }
  };

  const handleMainSelect = (background: SpaceBackground) => {
    trackTempUrl(background);
    setDraft((prev) => ({
      ...prev,
      main: { ...prev.main, background },
    }));
  };

  const handleGalleryImageAdded = (savedUrls: string[]) => {
    setDraft((prev) => ({
      ...prev,
      main: {
        ...prev.main,
        savedBackgroundImages: savedUrls,
      },
    }));
  };

  const handlePoolThumbSelect = (url: string) => {
    handleMainSelect(poolImageBackground(url));
  };

  const handlePoolUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPoolUploadError(null);

    if (!file.type.startsWith('image/')) {
      setPoolUploadError('画像ファイルを選択してください');
      return;
    }

    if (poolFileInputRef.current) {
      poolFileInputRef.current.value = '';
    }

    if (!isSupabaseConfigured || !space.id) {
      setPoolUploadError('Supabase 未設定のためプールに追加できません');
      return;
    }

    setIsPoolUploading(true);
    try {
      const result = await uploadBackgroundImage(space.id, file);
      if (!result.ok) {
        setPoolUploadError(`アップロード失敗: ${result.reason}`);
        return;
      }
      const next = appendSavedBackgroundUrl(pool, result.publicUrl);
      handleGalleryImageAdded(next);
    } catch (err) {
      console.error('[TabBackgroundBoard] pool upload failed', err);
      setPoolUploadError('アップロード中にエラーが発生しました');
    } finally {
      setIsPoolUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveBackgroundBoard(
        { space, panes, onUpdateSpace, reloadPanesAndSyncActive },
        draft,
        initial,
      );
      commitSaved();
      setToast({ message: '保存しました', type: 'success' });
    } catch (err) {
      console.error('[TabBackgroundBoard] save failed', err);
      const message =
        err instanceof PaneOverrideSaveError
          ? err.message
          : '保存に失敗しました';
      setToast({ message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <SettingsPageHeader
        title="背景"
        description="メインタブの背景を編集し、追加タブには共通プールの画像を割り当てます。"
      >
        {defaultPane && (
          <SettingsSection
            title={`${defaultPane.name}（メインタブ）`}
            description="色・パターン・テーマ・画像プールはメインタブで設定します。ここがスペース全体の基準背景になります。"
          >
            <div className={boardStyles.paneRow}>
              <div className={boardStyles.paneRowHeader}>
                <div className={boardStyles.paneRowMeta}>
                  <span className={boardStyles.paneRowStatus}>
                    現在: {describeBackground(draft.main.background)}
                  </span>
                  <BackgroundPreviewThumb
                    background={draft.main.background}
                    label={`${defaultPane.name}の背景プレビュー`}
                  />
                </div>
              </div>
              <div className={boardStyles.mainRowBody}>
                <BackgroundSelector
                  currentBackground={draft.main.background}
                  onSelect={handleMainSelect}
                  onImageUploaded={({ savedUrls }) => handleGalleryImageAdded(savedUrls)}
                  onImageURLRevoke={(url) => {
                    URL.revokeObjectURL(url);
                    objectURLsRef.current.delete(url);
                  }}
                  spaceId={space.id}
                  savedBackgroundImages={draft.main.savedBackgroundImages}
                  onUpdateSavedImages={(urls) =>
                    setDraft((prev) => ({
                      ...prev,
                      main: { ...prev.main, savedBackgroundImages: urls },
                    }))
                  }
                />
              </div>
            </div>
          </SettingsSection>
        )}

        <SettingsSection
          title={`共通プール（最大 ${MAX_BACKGROUND_IMAGES} 枚）`}
          description="追加タブに割り当てる画像を登録します。サムネイルをクリックするとメインタブの背景画像として選択されます。"
        >
          <div className={boardStyles.poolGallery}>
            {pool.map((url) => {
              const isActive =
                draft.main.background?.kind === 'image' &&
                draft.main.background.value === url;
              return (
                <div
                  key={url}
                  className={`${galleryStyles.galleryItem} ${isActive ? galleryStyles.galleryItemActive : ''}`}
                >
                  <button
                    type="button"
                    className={galleryStyles.galleryThumb}
                    onClick={() => handlePoolThumbSelect(url)}
                    title="メインタブの背景画像として選択"
                  >
                    <img src={url} alt="プール画像" className={galleryStyles.galleryImg} />
                    {isActive && <span className={galleryStyles.galleryCheck}>✓</span>}
                  </button>
                </div>
              );
            })}
            {pool.length < MAX_BACKGROUND_IMAGES && (
              <label
                className={`${galleryStyles.galleryAdd} ${isPoolUploading ? galleryStyles.galleryAddDisabled : ''}`}
                title={`画像を追加（最大${MAX_BACKGROUND_IMAGES}枚）`}
              >
                <input
                  ref={poolFileInputRef}
                  type="file"
                  accept="image/*"
                  className={galleryStyles.fileInput}
                  onChange={handlePoolUpload}
                  disabled={isPoolUploading}
                />
                <span className={galleryStyles.galleryAddIcon}>
                  {isPoolUploading ? '…' : '+'}
                </span>
                <span className={galleryStyles.galleryAddLabel}>
                  {isPoolUploading ? 'アップロード中' : '追加'}
                </span>
              </label>
            )}
          </div>
          {poolUploadError && (
            <p className={galleryStyles.uploadError} role="alert">
              {poolUploadError}
            </p>
          )}
          <p className={boardStyles.poolCount}>
            {pool.length} / {MAX_BACKGROUND_IMAGES} 枚
          </p>
        </SettingsSection>

        {additionalPanes.length > 0 && (
          <SettingsSection title="クイック操作">
            <div className={boardStyles.quickActions}>
              <button
                type="button"
                className={boardStyles.quickButton}
                onClick={() =>
                  setDraft((prev) => applyAllPanesToMain(prev, additionalPaneIds))
                }
              >
                すべてメインに合わせる
              </button>
              {POOL_SLOT_LABELS.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className={boardStyles.quickButton}
                  disabled={!pool[index]}
                  title={pool[index] ? undefined : 'メインタブの背景設定で画像を追加'}
                  onClick={() =>
                    setDraft((prev) =>
                      applyAllPanesToPoolIndex(prev, additionalPaneIds, index),
                    )
                  }
                >
                  すべて{label}に
                </button>
              ))}
            </div>
          </SettingsSection>
        )}

        {additionalPanes.length > 0 && (
          <SettingsSection
            title="追加タブの背景割り当て"
            description="各タブに、メインタブと同じ背景か、プールの画像を選びます。"
          >
            {additionalPanes.map((pane) => {
              const resolved = resolveDraftPaneBackground(pane, draft, space);
              return (
                <div key={pane.id} className={boardStyles.paneRow}>
                  <div className={boardStyles.paneRowHeader}>
                    <h3 className={boardStyles.paneRowTitle}>{pane.name}</h3>
                    <div className={boardStyles.paneRowMeta}>
                      <span className={boardStyles.paneRowStatus}>
                        現在: {describePaneAssignment(pane.id, draft)}（
                        {describeBackground(resolved)}）
                      </span>
                      <BackgroundPreviewThumb
                        background={resolved}
                        label={`${pane.name}の背景プレビュー`}
                      />
                    </div>
                  </div>
                  <PaneSegmentButtons
                    pane={pane}
                    draft={draft}
                    onAssign={(selection) =>
                      setDraft((prev) => setPaneAssignment(prev, pane.id, selection))
                    }
                  />
                </div>
              );
            })}
          </SettingsSection>
        )}

        <SettingsSaveBar
          isDirty={isDirty}
          isSaving={isSaving}
          onDiscard={discard}
          onSave={handleSave}
        />
      </SettingsPageHeader>

      {toast && (
        <div
          className={`${sharedStyles.toast} ${toast.type === 'success' ? sharedStyles.toastSuccess : sharedStyles.toastError}`}
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
