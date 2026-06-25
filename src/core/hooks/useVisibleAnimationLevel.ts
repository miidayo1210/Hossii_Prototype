import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnimationLevel } from '../utils/animationLevel';

/**
 * 画面内のみアニメーション tier を維持。画面外は none（87 §8 / PR-5）。
 */
export function useVisibleAnimationLevel(
  baseLevel: AnimationLevel,
  enabled = true,
): {
  ref: (node: HTMLElement | null) => void;
  level: AnimationLevel;
} {
  const [visible, setVisible] = useState(true);
  const nodeRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    nodeRef.current = node;
    if (!node || !enabled || baseLevel === 'none') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      { root: null, rootMargin: '48px', threshold: 0 },
    );
    io.observe(node);
    observerRef.current = io;
  }, [enabled, baseLevel]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const level: AnimationLevel =
    !enabled || baseLevel === 'none' ? baseLevel : visible ? baseLevel : 'none';

  return { ref, level };
}
