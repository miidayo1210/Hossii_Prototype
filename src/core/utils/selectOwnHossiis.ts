import { isOwnHossii } from './isOwnHossii';

export type SelectOwnHossiisParams = {
  /** ログイン中なら true。未確定の間は安全側に倒して false を渡すこと */
  isAuthenticated: boolean;
  /** ゲスト（未ログイン）の端末側 author_id */
  guestAuthorId?: string | null;
  /** ログイン本人の authorship 由来 hossii_id 集合（本人性の正本） */
  myAuthorshipIds: ReadonlySet<string>;
};

/**
 * 配列から「ビューアー本人の投稿」だけを抽出する純関数。
 *
 * 本人性の判定は {@link isOwnHossii} に委譲する薄いラッパー:
 * - ログイン中: myAuthorshipIds のみを正本とする（author_id フォールバックなし）。
 * - ゲスト: 端末側 author_id の一致で判定する。
 *
 * - 入力配列の順序を維持する（filter による安定順）。
 * - 入力配列・要素を破壊しない（新しい配列を返す）。
 * - authorship の取得状態（loading / error / ready）の UI 判断はここには含めない。
 *   呼び出し側で status を見て、未 ready のときは本関数を呼ばない設計にすること。
 *
 * 純関数（Supabase 呼び出し・session 取得・console 出力・throw・state 変更なし）。
 */
export function selectOwnHossiis<T extends { id: string; authorId?: string | null }>(
  hossiis: readonly T[],
  { isAuthenticated, guestAuthorId, myAuthorshipIds }: SelectOwnHossiisParams,
): T[] {
  return hossiis.filter((h) =>
    isOwnHossii({
      hossiiId: h.id,
      hossiiAuthorId: h.authorId,
      isAuthenticated,
      guestAuthorId,
      myAuthorshipIds,
    }),
  );
}
