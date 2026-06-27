import {
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
  type MouseEvent,
} from 'react';
import { Copy, Download } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { getDefaultQrRect } from '../../core/utils/floatingPanelStorage';
import { buildSpaceShareUrl } from '../../core/utils/spaceShareUrl';
import { svgQrToPngBlob } from '../../core/utils/qrSvgToPng';
import { FloatingPanelShell } from '../FloatingPanelShell/FloatingPanelShell';
import styles from './QRCodePanel.module.css';

/** SVG 内部解像度（CSS でスケールするため大きめに描画） */
const QR_RENDER_SIZE = 512;

async function copySvgQrAsPngToClipboard(svg: SVGElement): Promise<void> {
  const pngBlob = await svgQrToPngBlob(svg);
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('clipboard image API unavailable');
  }
  await navigator.clipboard.write([new ClipboardItem({ [pngBlob.type]: pngBlob })]);
}

function downloadPngBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function qrDownloadFilename(spaceURL: string | undefined): string {
  const raw = spaceURL?.trim();
  const safe = raw?.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return safe ? `hossii-qr-${safe}.png` : 'hossii-qr.png';
}

function QRCodePanelInner() {
  const { state, getActiveSpace, communitySlug } = useHossiiStore();
  const activeSpace = getActiveSpace();
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [qrImageCopied, setQrImageCopied] = useState(false);
  const [qrImageSaved, setQrImageSaved] = useState(false);

  const spaceUrl = buildSpaceShareUrl({
    origin: window.location.origin,
    communitySlug,
    spaceURL: activeSpace?.spaceURL,
    activeSpaceId: state.activeSpaceId ?? activeSpace?.id ?? '',
  });

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(spaceUrl).then(() => {
      setLinkCopied(true);
    });
  }, [spaceUrl]);

  useEffect(() => {
    if (!linkCopied) return;
    const t = window.setTimeout(() => setLinkCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [linkCopied]);

  useEffect(() => {
    if (!qrImageCopied) return;
    const t = window.setTimeout(() => setQrImageCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [qrImageCopied]);

  useEffect(() => {
    if (!qrImageSaved) return;
    const t = window.setTimeout(() => setQrImageSaved(false), 2000);
    return () => window.clearTimeout(t);
  }, [qrImageSaved]);

  const handleCopyQrImage = useCallback(() => {
    const svg = qrContainerRef.current?.querySelector('svg');
    if (!svg) return;
    void copySvgQrAsPngToClipboard(svg)
      .then(() => {
        setQrImageSaved(false);
        setQrImageCopied(true);
      })
      .catch(() => {
        /* 未対応ブラウザや権限エラーは黙って無視 */
      });
  }, []);

  const handleCopyQrImageClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      handleCopyQrImage();
    },
    [handleCopyQrImage]
  );

  const handleSaveQrImage = useCallback(() => {
    const svg = qrContainerRef.current?.querySelector('svg');
    if (!svg) return;
    void svgQrToPngBlob(svg)
      .then((blob) => {
        downloadPngBlob(blob, qrDownloadFilename(activeSpace?.spaceURL));
        setQrImageCopied(false);
        setQrImageSaved(true);
      })
      .catch(() => {
        /* 失敗時は黙って無視 */
      });
  }, [activeSpace?.spaceURL]);

  const handleSaveQrImageClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      handleSaveQrImage();
    },
    [handleSaveQrImage]
  );

  return (
    <div className={styles.qrBody}>
      <p className={styles.qrHeading}>📲 参加する</p>
      <div className={styles.qrSizeBox}>
        <div className={styles.qrWrap}>
          <div className={styles.qrHoverZone} data-no-drag>
            <div ref={qrContainerRef} className={styles.qrCodeInner}>
              <QRCode
                value={spaceUrl}
                size={QR_RENDER_SIZE}
                level="M"
                fgColor="#1f2937"
                bgColor="#ffffff"
              />
            </div>
            <div className={styles.qrImageActions}>
              <button
                type="button"
                className={styles.qrImageActionButton}
                data-no-drag
                aria-label="QR画像をコピー"
                title="QR画像をコピー"
                onClick={handleCopyQrImageClick}
              >
                <Copy size={16} strokeWidth={2.25} aria-hidden />
              </button>
              <button
                type="button"
                className={styles.qrImageActionButton}
                data-no-drag
                aria-label="QR画像を保存"
                title="QR画像を保存"
                onClick={handleSaveQrImageClick}
              >
                <Download size={16} strokeWidth={2.25} aria-hidden />
              </button>
            </div>
          </div>
        </div>
        {(qrImageCopied || qrImageSaved) && (
          <p className={styles.qrImageCopyFeedback} role="status">
            {qrImageCopied ? 'QR画像をコピーしました' : 'QR画像を保存しました'}
          </p>
        )}
      </div>
      <div className={styles.qrLabel} data-no-drag>
        <span className={styles.labelText}>QR コードをスキャン</span>
      </div>
      <button
        type="button"
        className={`${styles.copyLinkButton} ${linkCopied ? styles.copyLinkButtonCopied : ''}`}
        data-no-drag
        onClick={handleCopyLink}
      >
        {linkCopied ? 'コピーしました' : 'リンクをコピー'}
      </button>
    </div>
  );
}

export const QRCodePanel = () => {
  const defaultRect = useMemo(() => getDefaultQrRect(), []);

  return (
    <FloatingPanelShell
      storageKey="qr"
      defaultRect={defaultRect}
      minW={160}
      minH={160}
      zIndex={200}
      className={styles.qrFloating}
    >
      <QRCodePanelInner />
    </FloatingPanelShell>
  );
};
