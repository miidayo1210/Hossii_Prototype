import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { Copy, Download, Check, AlertCircle } from 'lucide-react';
import type { Space } from '../../core/types/space';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { useSpacePane } from '../../core/hooks/SpacePaneProvider';
import { isSupabaseConfigured } from '../../core/supabase';
import {
  generateSpaceURL,
  validateSpaceURL,
  isSpaceURLUnique,
} from '../../core/utils/spaceUrlUtils';
import {
  buildShareUrlForPane,
  buildSpaceShareUrl,
  paneQrDownloadFilename,
} from '../../core/utils/spaceShareUrl';
import { sortPanesForDisplay } from '../../core/utils/spacePaneManagement';
import { updateSpaceInDb } from '../../core/utils/spacesApi';
import { adminUpdateSpaceAccessMode } from '../../core/utils/spaceMembershipsApi';
import { useScreenDraft } from '../../core/hooks/useScreenDraft';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsSection } from './SettingsSection';
import { SettingsSaveBar } from './SettingsSaveBar';
import { PaneShareBlock } from './PaneShareBlock';
import sharedStyles from './SettingsShared.module.css';
import styles from './ShareTab.module.css';

type PublicShareDraft = {
  isPrivate: boolean;
  accessMode: 'public' | 'invite_only';
  spaceURLInput: string;
};

type Props = {
  space: Space;
  onUpdateSpace: (patch: Partial<Space>) => void;
  onDirtyChange: (dirty: boolean) => void;
};

export const PublicShareTab = ({ space, onUpdateSpace, onDirtyChange }: Props) => {
  const { state, communitySlug } = useHossiiStore();
  const { panes } = useSpacePane();
  const initial: PublicShareDraft = {
    isPrivate: space.isPrivate ?? false,
    accessMode: space.accessMode ?? 'public',
    spaceURLInput: space.spaceURL ?? '',
  };
  const { draft, setDraft, isDirty, discard, commitSaved } = useScreenDraft(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const savedURL = space.spaceURL ?? null;
  const validation = draft.spaceURLInput ? validateSpaceURL(draft.spaceURLInput) : null;
  const isUnique =
    validation?.valid && draft.spaceURLInput !== savedURL
      ? isSpaceURLUnique(draft.spaceURLInput, state.spaces, space.id)
      : true;
  const hasError = validation && !validation.valid;
  const isDuplicate = validation?.valid && !isUnique;

  const shareURL = savedURL
    ? buildSpaceShareUrl({
        origin: window.location.origin,
        communitySlug,
        spaceURL: savedURL,
        activeSpaceId: space.id,
      })
    : null;

  const additionalPanes = useMemo(
    () => sortPanesForDisplay(panes).filter((p) => !p.isDefault),
    [panes],
  );

  const showPaneQrSection =
    isSupabaseConfigured && shareURL !== null && panes.length >= 2 && additionalPanes.length > 0;

  const shareUrlParams = useMemo(
    () => ({
      origin: window.location.origin,
      communitySlug,
      spaceURL: savedURL ?? undefined,
      activeSpaceId: space.id,
    }),
    [communitySlug, savedURL, space.id],
  );

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSave = async () => {
    if (draft.spaceURLInput && (!validation?.valid || !isUnique)) return;
    setIsSaving(true);
    try {
      const patch: Partial<Space> = {
        isPrivate: draft.isPrivate,
        accessMode: draft.accessMode,
        spaceURL: draft.spaceURLInput || undefined,
      };
      onUpdateSpace(patch);
      if (draft.accessMode !== (space.accessMode ?? 'public')) {
        const modeRes = await adminUpdateSpaceAccessMode(space.id, draft.accessMode);
        if (!modeRes.ok) throw new Error(modeRes.message);
      }
      await updateSpaceInDb(space.id, {
        isPrivate: draft.isPrivate,
        spaceURL: draft.spaceURLInput || undefined,
      });
      commitSaved();
      setToast({ message: '保存しました', type: 'success' });
    } catch (err) {
      console.error('[PublicShareTab] save failed', err);
      setToast({ message: '保存に失敗しました', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!shareURL) return;
    await navigator.clipboard.writeText(shareURL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = useCallback(() => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const size = 300;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.download = `qr-${space.spaceURL ?? space.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  }, [space.id, space.spaceURL]);

  return (
    <>
      <SettingsPageHeader
        title="公開・共有"
        description="誰がアクセスできるか、どう招待するかを設定します。"
      >
        <SettingsSection title="公開範囲">
          <div className={styles.radioList ?? ''} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.9)', cursor: 'pointer' }}>
              <input
                type="radio"
                name="accessMode"
                checked={draft.accessMode === 'public'}
                onChange={() => setDraft({ ...draft, accessMode: 'public' })}
              />
              公開（URL を知っている人・ゲスト可）
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.9)', cursor: 'pointer' }}>
              <input
                type="radio"
                name="accessMode"
                checked={draft.accessMode === 'invite_only'}
                onChange={() => setDraft({ ...draft, accessMode: 'invite_only' })}
              />
              招待制（スペースメンバーのみ）
            </label>
          </div>
          <p className={styles.description} style={{ marginTop: '0.75rem' }}>
            招待制にすると、追加したスペースメンバーと管理者だけがアクセスできます。既存の投稿は削除されません。
          </p>
        </SettingsSection>

        <SettingsSection title="ログイン要件（従来）">
          <div className={styles.radioList ?? ''} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.9)', cursor: 'pointer' }}>
              <input
                type="radio"
                name="visibility"
                checked={!draft.isPrivate}
                onChange={() => setDraft({ ...draft, isPrivate: false })}
              />
              ゲスト参加を許可
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.9)', cursor: 'pointer' }}>
              <input
                type="radio"
                name="visibility"
                checked={draft.isPrivate}
                onChange={() => setDraft({ ...draft, isPrivate: true })}
              />
              ログイン必須（非公開）
            </label>
          </div>
          <p className={styles.description} style={{ marginTop: '0.75rem' }}>
            非公開にすると、未ログインのゲストはこのスペースにアクセスできません（招待制とは別設定です）。
          </p>
        </SettingsSection>

        <SettingsSection title="スペース URL">
          <p className={styles.description}>
            この URL を共有すると、誰でもこのスペースに直接アクセスできます。
          </p>
          <div className={styles.inputRow}>
            <span className={styles.prefix}>
              {communitySlug
                ? `${window.location.origin}/c/${communitySlug}/s/`
                : `${window.location.origin}/s/`}
            </span>
            <input
              type="text"
              className={`${styles.urlInput} ${hasError || isDuplicate ? styles.inputError : ''}`}
              value={draft.spaceURLInput}
              onChange={(e) => setDraft({ ...draft, spaceURLInput: e.target.value.toLowerCase() })}
              placeholder="例: mornings-team"
              maxLength={40}
            />
            <button
              type="button"
              className={styles.generateButton}
              onClick={() => setDraft({ ...draft, spaceURLInput: generateSpaceURL() })}
            >
              自動生成
            </button>
          </div>
          {hasError && (
            <p className={styles.errorMessage}>
              <AlertCircle size={14} />
              {(validation as { valid: false; error: string }).error}
            </p>
          )}
          {isDuplicate && (
            <p className={styles.errorMessage}>
              <AlertCircle size={14} />
              この URL はすでに使用されています
            </p>
          )}
          {savedURL && draft.spaceURLInput !== savedURL && validation?.valid && isUnique && (
            <p className={styles.warningText}>※ URL を変更すると、配布済みの QR コードは無効になります</p>
          )}
        </SettingsSection>

        {shareURL ? (
          <SettingsSection title="QR コード">
            <p className={styles.description}>スキャンするとこのスペースに直接アクセスできます。</p>
            <div className={styles.qrWrapper} ref={qrRef}>
              <QRCode value={shareURL} size={180} level="M" fgColor="#1f2937" bgColor="#ffffff" />
            </div>
            <div className={styles.qrActions}>
              <div className={styles.urlDisplay}>
                <span className={styles.urlText}>{shareURL}</span>
                <button type="button" className={`${styles.iconButton} ${copied ? styles.copied : ''}`} onClick={handleCopy}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'コピー済み' : 'URLをコピー'}
                </button>
              </div>
              <button type="button" className={styles.downloadButton} onClick={handleDownloadQR}>
                <Download size={16} />
                QRコードをダウンロード
              </button>
            </div>
          </SettingsSection>
        ) : (
          <SettingsSection title="QR コード">
            <p className={styles.emptyState}>スペース URL を保存すると、QR コードが表示されます。</p>
          </SettingsSection>
        )}

        {showPaneQrSection && (
          <SettingsSection title="タブごとの QR コード">
            <p className={styles.description}>
              メインタブは上の QR コードから。追加タブは以下の URL で直接開けます。
            </p>
            {additionalPanes.map((pane) => (
              <PaneShareBlock
                key={pane.id}
                label={pane.name}
                shareUrl={buildShareUrlForPane({
                  ...shareUrlParams,
                  pane: { slug: pane.slug, isDefault: pane.isDefault },
                })}
                downloadFilename={paneQrDownloadFilename(savedURL ?? undefined, space.id, pane.slug)}
                disabled={!pane.isVisible}
                disabledHint={
                  !pane.isVisible
                    ? '非表示のためこの URL は現在使えません。再表示すると利用できます。'
                    : undefined
                }
              />
            ))}
          </SettingsSection>
        )}

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
