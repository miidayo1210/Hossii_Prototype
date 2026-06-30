import { useCallback, useRef, useState } from 'react';
import type { NewHossiiPayload } from './types';

type ToastState = {
  hossii: NewHossiiPayload;
  show: boolean;
};

/**
 * 連続到着時はキューで順番に表示する簡易フック。
 */
export function useNewHossiiToast() {
  const queueRef = useRef<NewHossiiPayload[]>([]);
  const [state, setState] = useState<ToastState | null>(null);

  const pump = useCallback(() => {
    if (state?.show) return;
    const next = queueRef.current.shift();
    if (!next) {
      setState(null);
      return;
    }
    setState({ hossii: next, show: true });
  }, [state?.show]);

  const notify = useCallback(
    (hossii: NewHossiiPayload) => {
      queueRef.current.push(hossii);
      pump();
    },
    [pump],
  );

  const close = useCallback(() => {
    setState((prev) => (prev ? { ...prev, show: false } : null));
    window.setTimeout(pump, 220);
  }, [pump]);

  return {
    toast: state,
    notify,
    close,
  };
}
