import { selectOwnHossiis } from './selectOwnHossiis';
import type { MyAuthorshipIdsStatus } from './myAuthorshipIdsController';
import type { LogScope } from './logScopeStorage';

export type ResolveLogScopeSelectionParams = {
  /** 現在のログスコープ */
  logScope: LogScope;
  /** ログイン中なら true（管理者含む） */
  isAuthenticated: boolean;
  /** ゲスト（未ログイン）の端末側 author_id。ログイン中は undefined を渡す */
  guestAuthorId?: string | null;
  /** ログイン本人の authorship 由来 hossii_id 集合（本人性の正本） */
  myAuthorshipIds: ReadonlySet<string>;
  /** myAuthorshipIds の取得状態。ログイン中は 'ready' 以外を本人判定に信頼しない */
  myAuthorshipIdsStatus: MyAuthorshipIdsStatus;
};

export type LogScopeSelection<T> = {
  /** 全 visible 件数（authorship 取得状態に依存しない） */
  allCount: number;
  /** 本人投稿の件数（未 ready 時は 0） */
  mineCount: number;
  /** 現在スコープの一覧。'mine' は本人投稿、'all' は visibleHossiis */
  scopedHossiis: T[];
};

/**
 * LogListBody 固有の「all / mine スコープ選択」を解決する純関数。
 *
 * 本人性ルール（Phase 1E 確定方針）:
 * - ログイン中（管理者含む）: authorship が 'ready' のときのみ myAuthorshipIds で本人抽出。
 *   idle / loading / error の間は mine を空扱いにし、author_id へフォールバックしない。
 * - ゲスト: status に依存せず、端末 author_id の一致で即確定。
 * - 'all' スコープは authorship 取得状態に一切影響されない（常に visibleHossiis）。
 *
 * 本人投稿は 1 度だけ抽出し、mineCount と mine 一覧で再利用する（二重 filter を避ける）。
 *
 * 純関数（副作用・throw・入力破壊なし。scopedHossiis は入力または filter 由来の新配列）。
 */
export function resolveLogScopeSelection<T extends { id: string; authorId?: string | null }>(
  visibleHossiis: T[],
  {
    logScope,
    isAuthenticated,
    guestAuthorId,
    myAuthorshipIds,
    myAuthorshipIdsStatus,
  }: ResolveLogScopeSelectionParams,
): LogScopeSelection<T> {
  // ログイン中は authorship が ready になるまで本人性を確定しない。ゲストは常に確定。
  const isMineReady = !isAuthenticated || myAuthorshipIdsStatus === 'ready';

  const ownVisibleHossiis = isMineReady
    ? selectOwnHossiis(visibleHossiis, { isAuthenticated, guestAuthorId, myAuthorshipIds })
    : [];

  return {
    allCount: visibleHossiis.length,
    mineCount: ownVisibleHossiis.length,
    scopedHossiis: logScope === 'mine' ? ownVisibleHossiis : visibleHossiis,
  };
}
