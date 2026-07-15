// スペース単位の「投稿 ID → 現在表示名」マップの取得・保持・race 制御を担う純粋な controller
// （Phase 2C）。myAuthorshipIdsController と同型の seq guard / space 単位クリアを踏襲する。
//
// ルール:
//   - space 単位で取得する。space 切替時は旧 space のマップを即クリアしてから取得する。
//   - 古い（superseded / dispose 後）応答は seq guard で破棄し、新 space へ反映しない。
//   - 取得失敗しても投稿表示を止めない（空マップ + status='error' を emit するだけ）。
//   - 同一 space の再要求では再 fetch しない（無限 retry / 連打防止）。error 後の同一 key も retry しない。
//   - React に依存しないため node 環境で単体テストできる。

export type PostAuthorNamesStatus = 'idle' | 'loading' | 'ready' | 'error';

export type PostAuthorNamesSnapshot = {
  /** hossii_id → 現在のスペースニックネーム。空は共有インスタンスを使い回す */
  names: ReadonlyMap<string, string>;
  status: PostAuthorNamesStatus;
};

export type PostAuthorNamesSyncInput = {
  /** 認証・設定などが確定していれば true（未確定は false＝安全側でクリア） */
  ready: boolean;
  /** 現在の space ID。未確定は null | undefined */
  spaceId: string | null | undefined;
};

export type PostAuthorNamesControllerDeps = {
  /** 指定 space の「投稿 ID → 現在表示名」を取得する */
  fetchNames: (spaceId: string) => Promise<Map<string, string>>;
  /** snapshot が変化したときだけ呼ばれる */
  onChange: (snapshot: PostAuthorNamesSnapshot) => void;
  /** 取得失敗時の最小限の通知（PII を含めない） */
  onError?: (message: string) => void;
};

export type PostAuthorNamesController = {
  sync: (input: PostAuthorNamesSyncInput) => void;
  /** 同一 space でも強制再取得（nickname 更新の反映用。今回は未使用だが将来用に用意） */
  refresh: (spaceId: string | null | undefined) => void;
  reset: () => void;
  dispose: () => void;
  getSnapshot: () => PostAuthorNamesSnapshot;
};

/** 空マップの共有インスタンス（参照安定のため空へ戻すたびに new しない） */
export const EMPTY_POST_AUTHOR_NAMES: ReadonlyMap<string, string> = new Map<
  string,
  string
>();

export function createPostAuthorNamesController(
  deps: PostAuthorNamesControllerDeps,
): PostAuthorNamesController {
  const { fetchNames, onChange, onError } = deps;

  let seq = 0;
  let disposed = false;
  let currentKey: string | null = null;
  let snapshot: PostAuthorNamesSnapshot = {
    names: EMPTY_POST_AUTHOR_NAMES,
    status: 'idle',
  };

  const emit = (next: PostAuthorNamesSnapshot) => {
    if (next.names === snapshot.names && next.status === snapshot.status) return;
    snapshot = next;
    onChange(snapshot);
  };

  const clearTo = (status: PostAuthorNamesStatus) => {
    seq += 1;
    currentKey = null;
    emit({ names: EMPTY_POST_AUTHOR_NAMES, status });
  };

  const startFetch = (key: string, spaceId: string) => {
    currentKey = key;
    const mySeq = ++seq;

    // 取得開始時点で前 space の値を即クリアする（旧 space のマップを残さない）。
    emit({ names: EMPTY_POST_AUTHOR_NAMES, status: 'loading' });

    void fetchNames(spaceId)
      .then((names) => {
        if (disposed || mySeq !== seq) return; // stale / superseded / disposed
        emit({
          names: names.size === 0 ? EMPTY_POST_AUTHOR_NAMES : names,
          status: 'ready',
        });
      })
      .catch((error) => {
        if (disposed || mySeq !== seq) return;
        onError?.(error instanceof Error ? error.message : 'unknown error');
        // 失敗でも投稿表示は止めない。空マップ + error（client は投稿時名へ fallback）。
        emit({ names: EMPTY_POST_AUTHOR_NAMES, status: 'error' });
      });
  };

  const sync: PostAuthorNamesController['sync'] = ({ ready, spaceId }) => {
    if (disposed) return;

    if (!ready || !spaceId) {
      clearTo('idle');
      return;
    }

    const key = spaceId;
    // 同一 space の再要求では再 fetch しない（error 後の同一 key も retry しない）。
    if (key === currentKey) return;

    startFetch(key, spaceId);
  };

  const refresh: PostAuthorNamesController['refresh'] = (spaceId) => {
    if (disposed || !spaceId) return;
    startFetch(spaceId, spaceId);
  };

  const reset = () => {
    if (disposed) return;
    clearTo('idle');
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    seq += 1;
  };

  const getSnapshot = () => snapshot;

  return { sync, refresh, reset, dispose, getSnapshot };
}
