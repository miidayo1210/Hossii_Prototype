import { useMemo, useLayoutEffect, useRef, useState, useCallback, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import { getDefaultQrRect } from '../../core/utils/floatingPanelStorage';
import { FloatingPanelShell } from '../FloatingPanelShell/FloatingPanelShell';
import styles from './QRCodePanel.module.css';

function QRCodePanelInner() {
  const { state, getActiveSpace, communitySlug } = useHossiiStore();
  const activeSpace = getActiveSpace();
  const sizeBoxRef = useRef<HTMLDivElement>(null);
  const [qrSize, setQrSize] = useState(120);
  const [linkCopied, setLinkCopied] = useState(false);

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

  return (
    <div className={styles.qrBody}>
      <div ref={sizeBoxRef} className={styles.qrSizeBox}>
        <div className={styles.qrContainer} data-no-drag>
          <QRCode
            value={spaceUrl}
            size={qrSize}
            level="M"
            fgColor="#1f2937"
            bgColor="#ffffff"
          />
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
