import { useState, useRef, useCallback } from 'react';
import QRCode from 'react-qr-code';
import { Copy, Download, Check, AlertCircle } from 'lucide-react';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import {
  generateSpaceURL,
  validateSpaceURL,
  isSpaceURLUnique,
} from '../../core/utils/spaceUrlUtils';
import styles from './ShareTab.module.css';

export const ShareTab = () => {
  const { state, updateSpace, getActiveSpace } = useHossiiStore();
  const activeSpace = getActiveSpace();

  const [inputValue, setInputValue] = useState(activeSpace?.spaceURL ?? '');
  const [isSaved, setIsSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  if (!activeSpace) return null;

  const spaceURL = activeSpace.spaceURL;
  const shareURL = spaceURL
    ? `${window.location.origin}/s/${spaceURL}`
    : null;

  const validation = inputValue ? validateSpaceURL(inputValue) : null;
  const isUnique =
    validation?.valid && inputValue !== spaceURL
      ? isSpaceURLUnique(inputValue, state.spaces, activeSpace.id)
      : true;

  const hasError = validation && !validation.valid;
  const isDuplicate = validation?.valid && !isUnique;
  const canSave =
    inputValue.length > 0 &&
    validation?.valid &&
    isUnique &&
    inputValue !== spaceURL;

  const handleGenerate = () => {
    const generated = generateSpaceURL();
    setInputValue(generated);
    setIsSaved(false);
  };

  const handleSave = useCallback(() => {
    if (!canSave) return;
    updateSpace(activeSpace.id, { spaceURL: inputValue });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  }, [canSave, activeSpace.id, inputValue, updateSpace]);

  const handleCopy = useCallback(async () => {
    if (!shareURL) return;
    await navigator.clipboard.writeText(shareURL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareURL]);

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
      link.download = `qr-${activeSpace.spaceURL ?? activeSpace.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  }, [activeSpace]);

  return (
    <div className={styles.container}>
      {/* スペースURL設定 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>スペース URL</h2>
        <p className={styles.description}>
          このURLを共有すると、誰でもこのスペースに直接アクセスできます。
        </p>

        <div className={styles.inputRow}>
          <span className={styles.prefix}>{window.location.origin}/s/</span>
          <input
            type="text"
            className={`${styles.urlInput} ${hasError ? styles.inputError : ''} ${isDuplicate ? styles.inputError : ''}`}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value.toLowerCase());
              setIsSaved(false);
            }}
            placeholder="例: mornings-team"
            maxLength={40}
          />
          <button
            className={styles.generateButton}
            onClick={handleGenerate}
            type="button"
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
            このURLはすでに使用されています
          </p>
        )}
        {validation?.valid && isUnique && inputValue !== spaceURL && (
          <p className={styles.successMessage}>使用可能なURLです</p>
        )}

        <div className={styles.saveRow}>
          <button
            className={`${styles.saveButton} ${isSaved ? styles.saved : ''}`}
            onClick={handleSave}
            disabled={!canSave}
            type="button"
          >
            {isSaved ? (
              <>
                <Check size={16} />
                保存しました
              </>
            ) : (
              'URLを保存'
            )}
          </button>
          {spaceURL && inputValue !== spaceURL && (
            <p className={styles.warningText}>
              ※ URLを変更すると、配布済みのQRコードは無効になります
            </p>
          )}
        </div>
      </section>

      {/* QRコード */}
      {shareURL ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>QR コード</h2>
          <p className={styles.description}>
            スキャンするとこのスペースに直接アクセスできます。
          </p>

          <div className={styles.qrWrapper} ref={qrRef}>
            <QRCode
              value={shareURL}
              size={180}
              level="M"
              fgColor="#1f2937"
              bgColor="#ffffff"
            />
          </div>

          <div className={styles.qrActions}>
            <div className={styles.urlDisplay}>
              <span className={styles.urlText}>{shareURL}</span>
              <button
                className={`${styles.iconButton} ${copied ? styles.copied : ''}`}
                onClick={handleCopy}
                type="button"
                title="URLをコピー"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'コピー済み' : 'URLをコピー'}
              </button>
            </div>

            <button
              className={styles.downloadButton}
              onClick={handleDownloadQR}
              type="button"
            >
              <Download size={16} />
              QRコードをダウンロード
            </button>
          </div>
        </section>
      ) : (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>QR コード</h2>
          <p className={styles.emptyState}>
            スペースURLを設定すると、QRコードが表示されます。
          </p>
        </section>
      )}
    </div>
  );
};
