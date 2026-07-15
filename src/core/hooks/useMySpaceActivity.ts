import { useEffect, useState } from 'react';
import { fetchMySpaceActivity } from '../utils/mySpaceActivityApi';
import type { MyHossiiActivity } from '../utils/myHossiiActivity';

type State = {
  /** DB 正本の本人アクティビティ。未取得 / 失敗時は null（暫定表示へ fallback）。 */
  activity: MyHossiiActivity | null;
  loading: boolean;
};

/**
 * ログイン本人のスペース全体の個人ログ（正確な件数・直近ログ）を DB から取得する。
 * - enabled が false / spaceId 無し / 未ログインでは何もせず null を返す。
 * - RPC 失敗時は activity=null（呼び出し側はロード済みデータの暫定表示を維持）。
 */
const EMPTY: State = { activity: null, loading: false };

export function useMySpaceActivity(
  spaceId: string | null | undefined,
  enabled: boolean,
): State {
  const [state, setState] = useState<State>(EMPTY);

  useEffect(() => {
    if (!enabled || !spaceId) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setState((prev) => ({ ...prev, loading: true }));
    });

    fetchMySpaceActivity(spaceId)
      .then((activity) => {
        if (!cancelled) setState({ activity, loading: false });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.warn('[useMySpaceActivity]', error);
          setState({ activity: null, loading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [spaceId, enabled]);

  if (!enabled || !spaceId) return EMPTY;

  return state;
}
