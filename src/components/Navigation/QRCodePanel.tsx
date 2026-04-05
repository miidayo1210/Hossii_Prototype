import {
  useMemo,
  useLayoutEffect,
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
import { FloatingPanelShell } from '../FloatingPanelShell/FloatingPanelShell';
import styles from './QRCodePanel.module.css';

async function svgQrToPngBlob(svg: SVGElement): Promise<Blob> {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || svg.clientWidth || 256;
      const h = img.naturalHeight || svg.clientHeight || 256;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('2d context unavailable'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (blob) resolve(blob);
          else reject(new Error('toBlob failed'));
        },
        'image/png',
        1
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('svg image load failed'));
    };
    img.src = objectUrl;
  });
}

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
  const sizeBoxRef = useRef<HTMLDivElement>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const [qrSize, setQrSize] = useState(120);
  const [linkCopied, setLinkCopied] = useState(false);
  const [qrImageCopied, setQrImageCopied] = useState(false);
  const [qrImageSaved, setQrImageSaved] = useState(false);

  const spaceUrl = activeSpace?.spaceURL
    ? communitySlug
      ? `${window.location.origin}/c/${communitySlug}/s/${activeSpace.spaceURL}`
      : `${window.location.origin}/s/${activeSpace.spaceURL}`
    : state.activeSpaceId
      ? `${window.location.origin}?space=${state.activeSpaceId}`
      : window.location.origin;

  useLayoutEffect(() => {
    const el = sizeBoxRef.current;
    if (!el) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const pad = 20;
      const s = Math.floor(Math.min(width, height) - pad);
      setQrSize(Math.max(64, Math.min(400, s)));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
      <div ref={sizeBoxRef} className={styles.qrSizeBox}>
        <div className={styles.qrWrap}>
          <div className={styles.qrHoverZone} data-no-drag>
            <div ref={qrContainerRef} className={styles.qrCodeInner}>
              <QRCode
                value={spaceUrl}
                size={qrSize}
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
          {(qrImageCopied || qrImageSaved) && (
            <p className={styles.qrImageCopyFeedback} role="status">
              {qrImageCopied ? 'QR画像をコピーしました' : 'QR画像を保存しました'}
            </p>
          )}
        </div>
      </div>
      <div className={styles.qrLabel} data-no-drag>
        <span className={styles.labelIcon}>📱</span>
        <span className={styles.labelText}>スマホで参加</span>
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
