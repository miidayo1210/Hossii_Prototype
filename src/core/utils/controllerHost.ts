// StrictMode 安全な controller ライフサイクル管理の汎用ホスト。
//
// 背景（Phase 1D-2-fix と同じ）: React 18 StrictMode の dev では effect が
// setup → cleanup → setup と再実行される。cleanup で controller を dispose しても参照を
// 保持し続けると、2 回目以降の setup が破棄済み instance を掴んで no-op になる。
// そこで「dispose する責務は controller 側、破棄後に差し替える責務はホスト側」に分離する。
//
// authorshipControllerHost（authorship 専用）と同じ設計の汎用版。dispose() を持つ任意の
// controller に使える。React 非依存で node 環境の単体テスト可能。

export type DisposableController = { dispose: () => void };

export type ControllerHost<T extends DisposableController> = {
  /** 現在の controller を返す。無ければ factory で生成（破棄済みは返さない）。 */
  getOrCreate: () => T;
  /** 現在保持している controller（無ければ null）。生成はしない。 */
  peek: () => T | null;
  /** 渡された controller を dispose し、それが現在値のときだけ保持をクリアする。 */
  disposeIfCurrent: (controller: T) => void;
};

export function createControllerHost<T extends DisposableController>(
  factory: () => T,
): ControllerHost<T> {
  let current: T | null = null;

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
