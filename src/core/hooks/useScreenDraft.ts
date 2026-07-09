import { useCallback, useEffect, useMemo, useState } from 'react';

function draftsEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 明示的保存画面用の下書き状態。
 * タブ切替でアンマウントされる前提で initial を saved/draft の初期値に使う。
 */
export function useScreenDraft<T>(initial: T) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);

  const initialKey = JSON.stringify(initial);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset draft when screen initial props change
    setSaved(initial);
    setDraft(initial);
  }, [initialKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = useMemo(() => !draftsEqual(saved, draft), [saved, draft]);

  const discard = useCallback(() => {
    setDraft(saved);
  }, [saved]);

  const commitSaved = useCallback((next?: T) => {
    const value = next ?? draft;
    setSaved(value);
    setDraft(value);
  }, [draft]);

  return { draft, setDraft, saved, isDirty, discard, commitSaved };
}
