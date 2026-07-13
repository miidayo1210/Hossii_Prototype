// 投稿者名の表示解決（Phase 2C）。
//
// 「現在のスペースニックネーム」と「投稿時の名前（hossiis.author_name のスナップショット）」を
// 両立して表示するための純関数。React / DB に依存しない。
//
// ルール:
//   - 現在名があるとき: 現在名を主表示。投稿時名が現在名と異なる場合のみ投稿時名を補足として返す。
//   - 現在名が無いとき（ゲスト投稿 / authorship や membership が無い / nickname が null 等）:
//     投稿時名のみを表示する（表示を止めない）。
//   - 現在名と投稿時名が同じなら 1 つだけ（postedNameLabel = null）。
//
// postedNameLabel は「投稿時の生のニックネーム」を返す（UI 側で「投稿時：{name}」に整形する）。

export type PostAuthorDisplayInput = {
  /** 投稿時の名前スナップショット（hossii.authorName） */
  postedName: string | null | undefined;
  /** 現在のスペースニックネーム（RPC 由来）。無ければ null/undefined */
  currentName: string | null | undefined;
  /** 閲覧者本人の投稿か（「あなた」表示などの任意 UI 用） */
  isOwnPost: boolean;
};

export type PostAuthorDisplay = {
  /** 主表示名。現在名 → 投稿時名 の順で確定（両方空なら空文字） */
  primaryName: string;
  /** 補足表示する「投稿時の名前」。現在名と同じ / 現在名が無い / 投稿時名が空 のときは null */
  postedNameLabel: string | null;
  /** 閲覧者本人の投稿か */
  isCurrentUser: boolean;
};

export function resolvePostAuthorDisplay(
  input: PostAuthorDisplayInput,
): PostAuthorDisplay {
  const posted = input.postedName?.trim() ?? '';
  const current = input.currentName?.trim() ?? '';

  if (current) {
    return {
      primaryName: current,
      postedNameLabel: posted && posted !== current ? posted : null,
      isCurrentUser: input.isOwnPost,
    };
  }

  // 現在名なし → 投稿時名のみ
  return {
    primaryName: posted,
    postedNameLabel: null,
    isCurrentUser: input.isOwnPost,
  };
}
