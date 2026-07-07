import { useCallback, useEffect, useState } from 'react';
import { fetchMyHossiiParticipants } from '../utils/myHossiiParticipantsApi';
import type { MyHossiiParticipant } from '../types/myHossii';

type State = {
  participants: MyHossiiParticipant[];
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: State = { participants: [], isLoading: false, error: null };

export function useMyHossiiParticipants(
  spaceId: string | null | undefined,
  enabled: boolean,
): State & { retry: () => void } {
  const [state, setState] = useState<State>(EMPTY);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !spaceId) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
      }
    });

    fetchMyHossiiParticipants(spaceId)
      .then((participants) => {
        if (!cancelled) {
          setState({ participants, isLoading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error('[useMyHossiiParticipants]', error);
          setState({
            participants: [],
            isLoading: false,
            error: error instanceof Error ? error : new Error('取得に失敗しました'),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [spaceId, enabled, retryCount]);

  if (!enabled || !spaceId) {
    return { participants: [], isLoading: false, error: null, retry };
  }

  return { ...state, retry };
}
