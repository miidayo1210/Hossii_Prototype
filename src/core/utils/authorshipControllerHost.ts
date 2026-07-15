import type { MyAuthorshipIdsController } from './myAuthorshipIdsController';

/**
 * `MyAuthorshipIdsController` のライフサイクルを 1 箇所で管理する純粋なホスト。
 *
 * 背景（Phase 1D-2-fix）:
 * React 18 StrictMode の dev では effect が `setup → cleanup → setup` と再実行される。
 * cleanup で controller を `dispose()` しても、参照を保持したままだと 2 回目の setup 以降の
 * `sync()` / `refresh()` が破棄済み instance を掴んで no-op になり、authorship が
 * 永久に取得されない（status が idle のまま／リクエスト 0 件）。
 *
 * そこで controller を「不可逆に dispose する」責務は controller 側に残し、
 * 破棄後に新 instance へ差し替える責務をこのホストへ集約する。
 * - `getOrCreate()`: 保持がなければ factory で生成する。破棄済み instance は決して返さない。
 * - `disposeIfCurrent()`: 渡された controller を dispose し、それが現在値のときだけクリアする。
 * - `peek()`: 現在保持している controller（無ければ null）。生成はしない。
 *
 * React に依存しないため node 環境の単体テストで StrictMode 相当の流れを検証できる。
 */
export type AuthorshipControllerHost = {
  /**
   * 現在の controller を返す。保持が無ければ factory で生成する。
   * StrictMode の 2 回目 setup（cleanup 後）でも新しい instance を確実に生成する。
   */
  getOrCreate: () => MyAuthorshipIdsController;
  /**
   * 現在保持している controller を返す。無ければ null。
   * 生成はしないため、unmount 後の非同期処理（投稿後 refresh 等）から安全に呼べる。
   */
  peek: () => MyAuthorshipIdsController | null;
  /**
   * 渡された controller を dispose し、それが現在値と同一のときだけ保持をクリアする。
   * 同一でない（既に別 instance へ差し替わっている）場合は保持を触らない。
   */
  disposeIfCurrent: (controller: MyAuthorshipIdsController) => void;
};

export function createAuthorshipControllerHost(
  factory: () => MyAuthorshipIdsController,
): AuthorshipControllerHost {
  let current: MyAuthorshipIdsController | null = null;

  return {
    getOrCreate: () => {
      if (current === null) {
        current = factory();
      }
      return current;
    },
    peek: () => current,
    disposeIfCurrent: (controller) => {
      controller.dispose();
      if (current === controller) {
        current = null;
      }
    },
  };
}
