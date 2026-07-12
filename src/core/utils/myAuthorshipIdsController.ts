export type MyAuthorshipIdsStatus = 'idle' | 'loading' | 'ready' | 'error';

export type MyAuthorshipIdsSnapshot = {
  /** ログイン本人の authorship 由来 hossii_id 集合（本人性の正本） */
  ids: ReadonlySet<string>;
  status: MyAuthorshipIdsStatus;
};

export type MyAuthorshipIdsSyncInput = {
  /** 認証状態が確定済みなら true（未確定は false を渡す＝安全側でクリア） */
  authReady: boolean;
  /** ログイン本人の auth UID。未ログイン / ゲストは null | undefined */
  uid: string | null | undefined;
  /** 現在の space ID。未確定は null | undefined */
  spaceId: string | null | undefined;
};

export type MyAuthorshipIdsControllerDeps = {
  /**
   * 指定 space 内の本人 authorship 付き hossii_id を取得する。
   * 本人限定は RLS に委ね、auth UID は引数に取らない（Phase 1C の API 仕様）。
   */
  fetchIds: (spaceId: string) => Promise<string[]>;
  /** snapshot が変化したときだけ呼ばれる */
  onChange: (snapshot: MyAuthorshipIdsSnapshot) => void;
  /** 取得失敗時の最小限の通知（PII を含めない） */
  onError?: (message: string) => void;
};

export type MyAuthorshipIdsController = {
  /** 認証・space の現在値を渡して取得/リセットを判断する */
  sync: (input: MyAuthorshipIdsSyncInput) => void;
  /** 即時に空集合へ戻し、in-flight 応答を無効化する */
  reset: () => void;
  /** unmount 相当。以後すべての反映を止める */
  dispose: () => void;
  /** 現在の snapshot を返す（テスト・初期化用） */
  getSnapshot: () => MyAuthorshipIdsSnapshot;
};

/**
 * 空集合の共有インスタンス。
 * 空へ戻すたびに new Set() すると参照が変わり不要な再 render を招くため、
 * 「空」は常にこの単一参照を使い回す。
 */
export const EMPTY_MY_AUTHORSHIP_IDS: ReadonlySet<string> = new Set<string>();

/**
 * `myAuthorshipIds` の取得・保持・リセット・race 制御を担う純粋なコントローラ。
 *
 * React に依存しないため node 環境の単体テストで挙動を検証できる。
 * HossiiStoreProvider は本コントローラを useRef で1つ生成し、認証・space 変更の
 * effect から `sync()` を、unmount で `dispose()` を呼ぶだけの薄い glue で接続する。
 *
 * 本人性ルール（Phase 1A/1C/1D-1 の確定方針）:
 * - 本人性の正本は hossii_authorships。author_id は使わない。
 * - auth UID を fetch 引数に渡さない（RLS が本人行に限定する）。
 * - 未ログイン / ゲスト / space 無し / 認証未確定は空集合。
 * - 前 space・前 user の ID を次へ一瞬も残さない。
 * - 取得失敗時に本人扱いを広げない（空集合 + error）。
 */
export function createMyAuthorshipIdsController(
  deps: MyAuthorshipIdsControllerDeps,
): MyAuthorshipIdsController {
  const { fetchIds, onChange, onError } = deps;

  /** fetch の世代。stale 応答を破棄するための seq guard */
  let seq = 0;
  /** dispose 済みフラグ。以後は反映しない */
  let disposed = false;
  /** fetch 済み/中の user+space キー。同一キーの重複 fetch と無限 retry を防ぐ */
  let currentKey: string | null = null;
  let snapshot: MyAuthorshipIdsSnapshot = {
    ids: EMPTY_MY_AUTHORSHIP_IDS,
    status: 'idle',
  };

  const emit = (next: MyAuthorshipIdsSnapshot) => {
    if (next.ids === snapshot.ids && next.status === snapshot.status) return;
    snapshot = next;
    onChange(snapshot);
  };

  /** in-flight を無効化し、currentKey を捨てて空へ戻す */
  const clearTo = (status: MyAuthorshipIdsStatus) => {
    seq += 1;
    currentKey = null;
    emit({ ids: EMPTY_MY_AUTHORSHIP_IDS, status });
  };

  const reset = () => {
    if (disposed) return;
    clearTo('idle');
  };

  const sync: MyAuthorshipIdsController['sync'] = ({ authReady, uid, spaceId }) => {
    if (disposed) return;

    // 認証未確定は既存 ID を残さず空へ（安全側）。
    if (!authReady) {
      clearTo('idle');
      return;
    }

    // 未ログイン / ゲスト / space 無しは空。API を呼ばない。
    if (!uid || !spaceId) {
      clearTo('idle');
      return;
    }

    const key = `${uid}\u0000${spaceId}`;

    // 同一 user・同一 space の再要求では再 fetch しない
    // （重複 fetch の抑止。error 後の同一キー再要求でも retry しない）。
    if (key === currentKey) return;

    currentKey = key;
    const mySeq = ++seq;

    // 取得開始時点で前 space / 前 user の ID を即クリアする。
    emit({ ids: EMPTY_MY_AUTHORSHIP_IDS, status: 'loading' });

    void fetchIds(spaceId)
      .then((ids) => {
        // 切替後・unmount 後に届いた stale 応答は破棄する。
        if (disposed || mySeq !== seq) return;
        emit({ ids: new Set(ids), status: 'ready' });
      })
      .catch((error) => {
        if (disposed || mySeq !== seq) return;
        onError?.(error instanceof Error ? error.message : 'unknown error');
        emit({ ids: EMPTY_MY_AUTHORSHIP_IDS, status: 'error' });
      });
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    seq += 1;
  };

  const getSnapshot = () => snapshot;

  return { sync, reset, dispose, getSnapshot };
}
