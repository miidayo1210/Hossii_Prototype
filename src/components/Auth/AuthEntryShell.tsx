import { useEffect, useRef, useState } from 'react';
import { HossiiLive } from '../Hossii/HossiiLive';
import shell from './authEntryShell.module.css';
import { AUTH_ENTRY_BG_IMAGES } from './authEntryBg.config';
import { pickAuthEntryHossiiDecorUrl } from './authEntryHossiiPool';

/** 次のクロスフェードを開始するまでの間隔（前回フェード開始から） */
const SLIDE_INTERVAL_MS = 5_000;
/** フェード時間。authEntryShell.module.css の .slideCrossfade と揃える */
const FADE_MS = 1_000;

function usePrefersReducedMotion(): boolean {
  const [v, setV] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fn = () => setV(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return v;
}

type Props = {
  children: React.ReactNode;
};

/**
 * トップ・ログイン・管理者ログイン共通: 背景スライド・スクリム・装飾 Hossii・前面コンテンツ
 */
export function AuthEntryShell({ children }: Props) {
  const urls = AUTH_ENTRY_BG_IMAGES;
  const reduceMotion = usePrefersReducedMotion();
  const [bottomIdx, setBottomIdx] = useState(0);
  const [topIdx, setTopIdx] = useState<number | null>(null);
  const [topOpaque, setTopOpaque] = useState(false);
  const [entryHossiiSrc, setEntryHossiiSrc] = useState<string | null>(null);

  const bottomIdxRef = useRef(0);

  const showSlides = urls.length > 0;
  const displayIdx = reduceMotion ? 0 : bottomIdx;

  useEffect(() => {
    if (urls.length < 2 || reduceMotion) return;

    let cancelled = false;
    let fadeTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let rafOuter = 0;
    let rafInner = 0;

    const clearPendingAnimations = () => {
      if (fadeTimeoutId !== undefined) {
        clearTimeout(fadeTimeoutId);
        fadeTimeoutId = undefined;
      }
      if (rafOuter) {
        cancelAnimationFrame(rafOuter);
        rafOuter = 0;
      }
      if (rafInner) {
        cancelAnimationFrame(rafInner);
        rafInner = 0;
      }
    };

    const id = window.setInterval(() => {
      if (cancelled) return;

      clearPendingAnimations();

      const b = bottomIdxRef.current;
      const next = (b + 1) % urls.length;

      setTopIdx(next);
      setTopOpaque(false);

      rafOuter = requestAnimationFrame(() => {
        if (cancelled) return;
        rafInner = requestAnimationFrame(() => {
          if (cancelled) return;
          setTopOpaque(true);
        });
      });

      fadeTimeoutId = window.setTimeout(() => {
        if (cancelled) return;
        fadeTimeoutId = undefined;
        bottomIdxRef.current = next;
        setBottomIdx(next);
        setTopIdx(null);
        setTopOpaque(false);
        setEntryHossiiSrc(pickAuthEntryHossiiDecorUrl());
      }, FADE_MS);
    }, SLIDE_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      clearPendingAnimations();
    };
  }, [urls.length, reduceMotion]);

  useEffect(() => {
    if (urls.length < 2) return;
    const preload = (displayIdx + 1) % urls.length;
    const img = new Image();
    img.src = urls[preload];
  }, [urls, displayIdx]);

  const crossfadeClass = reduceMotion ? '' : shell.slideCrossfade;

  return (
    <div className={shell.shell}>
      {showSlides && (
        <div className={shell.slideLayer} aria-hidden>
          <img
            src={urls[displayIdx]}
            alt=""
            className={`${shell.slideImage} ${shell.slideImageVisible} ${crossfadeClass}`}
            decoding="async"
          />
          {topIdx !== null && (
            <img
              src={urls[topIdx]}
              alt=""
              className={`${shell.slideImage} ${topOpaque ? shell.slideImageVisible : shell.slideImageHidden} ${crossfadeClass}`}
              decoding="async"
            />
          )}
        </div>
      )}

      <div className={shell.scrim} aria-hidden />

      <div className={shell.hossiiLayer}>
        <div className={shell.hossiiFloatInner}>
          <HossiiLive
            decorative
            decorativeImageSrc={
              reduceMotion || !entryHossiiSrc ? undefined : entryHossiiSrc
            }
            isListening={false}
            onParticle={() => {}}
          />
        </div>
      </div>

      <div className={shell.content}>{children}</div>
    </div>
  );
}
