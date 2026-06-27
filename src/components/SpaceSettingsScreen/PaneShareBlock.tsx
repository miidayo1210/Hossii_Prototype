import { useCallback, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { Copy, Download, Check } from 'lucide-react';
import styles from './ShareTab.module.css';
import blockStyles from './PaneShareBlock.module.css';

type Props = {
  label: string;
  shareUrl: string;
  downloadFilename?: string;
  disabled?: boolean;
  disabledHint?: string;
  compact?: boolean;
};

export function PaneShareBlock({
  label,
  shareUrl,
  downloadFilename,
  disabled = false,
  disabledHint,
  compact = false,
}: Props) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (disabled) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [disabled, shareUrl]);

  const handleDownloadQR = useCallback(() => {
    if (disabled || !qrRef.current) return;
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
      link.download = downloadFilename ?? 'qr-pane.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  }, [disabled, downloadFilename]);

  const qrSize = compact ? 140 : 180;

  return (
    <div
      className={`${blockStyles.block}${compact ? ` ${blockStyles.compact}` : ''}${disabled ? ` ${blockStyles.disabled}` : ''}`}
    >
      {label ? <p className={blockStyles.label}>{label}</p> : null}
      {disabledHint && disabled ? (
        <p className={blockStyles.disabledHint}>{disabledHint}</p>
      ) : null}
      <div className={styles.qrWrapper} ref={qrRef} aria-hidden={disabled}>
        <QRCode
          value={shareUrl}
          size={qrSize}
          level="M"
          fgColor={disabled ? '#9ca3af' : '#1f2937'}
          bgColor="#ffffff"
        />
      </div>
      <div className={styles.qrActions}>
        <div className={styles.urlDisplay}>
          <span className={styles.urlText}>{shareUrl}</span>
          <button
            type="button"
            className={`${styles.iconButton} ${copied ? styles.copied : ''}`}
            disabled={disabled}
            onClick={() => void handleCopy()}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'コピー済み' : 'URLをコピー'}
          </button>
        </div>
        <button
          type="button"
          className={styles.downloadButton}
          disabled={disabled}
          onClick={handleDownloadQR}
        >
          <Download size={16} />
          QRコードをダウンロード
        </button>
      </div>
    </div>
  );
}
