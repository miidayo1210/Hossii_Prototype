import { useMemo } from 'react';
import type { SpacePane } from '../../core/types/spacePane';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import {
  buildShareUrlForPane,
  paneQrDownloadFilename,
} from '../../core/utils/spaceShareUrl';
import { PaneShareBlock } from './PaneShareBlock';
import dialogStyles from './PaneSlugEditDialog.module.css';
import shareDialogStyles from './PaneShareDialog.module.css';

type Props = {
  open: boolean;
  pane: SpacePane | null;
  spaceURL: string | undefined;
  spaceId: string;
  onClose: () => void;
};

export function PaneShareDialog({
  open,
  pane,
  spaceURL,
  spaceId,
  onClose,
}: Props) {
  const { communitySlug } = useHossiiStore();

  const shareUrl = useMemo(() => {
    if (!pane) return '';
    return buildShareUrlForPane({
      origin: window.location.origin,
      communitySlug,
      spaceURL,
      activeSpaceId: spaceId,
      pane: { slug: pane.slug, isDefault: pane.isDefault },
    });
  }, [pane, communitySlug, spaceURL, spaceId]);

  const disabled = pane ? !pane.isVisible : false;
  const downloadFilename = pane
    ? paneQrDownloadFilename(spaceURL, spaceId, pane.slug)
    : undefined;

  if (!open || !pane) return null;

  return (
    <div
      className={dialogStyles.overlay}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`${dialogStyles.modal} ${shareDialogStyles.modalWide}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pane-share-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pane-share-title" className={dialogStyles.title}>
          URL・QR コード
        </h2>
        <p className={dialogStyles.hint}>
          タブ: {pane.name}
          {pane.isDefault ? '（メイン — スペース全体 URL）' : `（/${pane.slug}）`}
        </p>
        <PaneShareBlock
          label=""
          shareUrl={shareUrl}
          downloadFilename={downloadFilename}
          disabled={disabled}
          disabledHint={
            disabled ? '非表示のためこの URL は現在使えません。再表示すると利用できます。' : undefined
          }
          compact
        />
        <div className={dialogStyles.actions}>
          <button
            type="button"
            className={dialogStyles.cancelButton}
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
