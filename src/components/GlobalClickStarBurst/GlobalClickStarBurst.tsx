import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import styles from './GlobalClickStarBurst.module.css';

const STAR_BURST_COUNT = 5;
const STAR_BURST_DIST = 11;
const STAR_EMOJIS = ['✦', '✧', '⋆', '✦', '✧'];
const CLEAR_MS = 420;

function StarBurstView({ x, y, burstId }: { x: number; y: number; burstId: number }) {
  return (
    <div className={styles.root} style={{ left: x, top: y }} aria-hidden>
      {Array.from({ length: STAR_BURST_COUNT }, (_, i) => {
        const angle = (Math.PI * 2 * i) / STAR_BURST_COUNT - Math.PI / 2;
        const tx = Math.cos(angle) * STAR_BURST_DIST;
        const ty = Math.sin(angle) * STAR_BURST_DIST;
        return (
          <span
            key={`${burstId}-${i}`}
            className={styles.particle}
            style={
              {
                '--tx': `${tx}px`,
                '--ty': `${ty}px`,
                animationDelay: `${i * 0.012}s`,
              } as CSSProperties
            }
          >
            {STAR_EMOJIS[i % STAR_EMOJIS.length]}
          </span>
        );
      })}
    </div>
  );
}

/**
 * document 上の primary click のたび、クリック位置に短い星バーストを表示する。
 * prefers-reduced-motion: reduce では発火しない。
 */
export function GlobalClickStarBurst() {
  const [burst, setBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    if (!burst) return;
    const t = window.setTimeout(() => setBurst(null), CLEAR_MS);
    return () => clearTimeout(t);
  }, [burst]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (typeof window === 'undefined') return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      /* キーボード等で座標が付かないクリックはスキップ */
      if (e.clientX === 0 && e.clientY === 0) return;
      idRef.current += 1;
      setBurst({ x: e.clientX, y: e.clientY, id: idRef.current });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  if (typeof document === 'undefined' || !burst) return null;

  return createPortal(<StarBurstView x={burst.x} y={burst.y} burstId={burst.id} />, document.body);
}
