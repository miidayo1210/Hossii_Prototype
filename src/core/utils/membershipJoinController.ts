// ログインユーザーの space_memberships 自動登録を司る純粋な controller（Phase 2B）。
//
// 責務:
//   - 「Supabase 設定済み・auth 確定・ログインセッションあり・active space あり・
//      ゲストでない」をすべて満たすときだけ join を 1 回実行する。
//   - 同一セッション中の (uid + spaceId) 重複実行を抑止（StrictMode の
//     setup→cleanup→setup を含む）。DB UNIQUE / RPC 冪等性に依存しきらない。
//   - user 切替・space 切替・logout→再login・前回失敗時は再実行できる。
//   - 無限 retry はしない（sync は依存変化時のみ呼ばれる想定で、失敗しても
//     自動連打しない）。
//   - join 失敗は握りつぶして呼び出し側（画面・ログイン）へ影響させない。
//
// React／Supabase へは一切依存しない（join / onError を注入）。

export type MembershipJoinInput = {
  configured: boolean;
  authReady: boolean;
  uid: string | null;
  spaceId: string | null;
  isGuest: boolean;
  /** public shared のみ true。invite_only では自己 join しない。 */
  allowAutoJoin: boolean;
  /** join 実行時に space_nickname を解決する。取得失敗時は null を返す（join は止めない）。 */
  resolveNickname: () => string | null;
};

export type MembershipJoinDeps = {
  /** role は渡さない。role は RPC 側で 'member' 固定。 */
  join: (spaceId: string, nickname: string | null) => Promise<unknown>;
  onError: (error: unknown) => void;
};

export interface MembershipJoinController {
  sync: (input: MembershipJoinInput) => void;
}

const keyOf = (uid: string, spaceId: string) => `${uid}\u0000${spaceId}`;

export function createMembershipJoinController(
  deps: MembershipJoinDeps,
): MembershipJoinController {
  // join 済み（成功）の (uid+spaceId)。同一セッション中の重複を防ぐ。
  let lastSuccessKey: string | null = null;
  // 実行中の (uid+spaceId)。StrictMode の二重 setup 連打を防ぐ。
  let inFlightKey: string | null = null;

  return {
    sync: (input) => {
      const { configured, authReady, uid, spaceId, isGuest, allowAutoJoin, resolveNickname } = input;

      // ログアウト / ゲスト / invite_only = 対象外。
      if (!uid || isGuest || !allowAutoJoin) {
        lastSuccessKey = null;
        inFlightKey = null;
        return;
      }

      // 一時的に未確定（auth 解決中・未設定・space 未確定）なら何もしない。
      // dedupe 状態は保持する（transient なフリップで無駄な再 join をしない）。
      if (!configured || !authReady || !spaceId) {
        return;
      }

      const key = keyOf(uid, spaceId);
      if (key === lastSuccessKey || key === inFlightKey) {
        return; // 既に join 済み / 実行中
      }

      inFlightKey = key;

      let nickname: string | null = null;
      try {
        nickname = resolveNickname();
      } catch {
        // nickname 取得失敗で join は止めない。
        nickname = null;
      }

      Promise.resolve(deps.join(spaceId, nickname))
        .then(() => {
          // 実行中に user/space が切り替わっていなければ成功として記録する。
          if (inFlightKey === key) {
            lastSuccessKey = key;
            inFlightKey = null;
          }
        })
        .catch((error) => {
          // 失敗時は lastSuccessKey を立てない → 次の sync（再訪問・切替等）で再試行可能。
          if (inFlightKey === key) {
            inFlightKey = null;
          }
          deps.onError(error);
        });
    },
  };
}

// ---------------------------------------------------------------------------
// space_nickname の決定（追加 DB query なし・すべて既存 state / currentUser から）。
// 優先順位: space 固有 nickname → profile 表示名 → auth username → displayName → null
// ---------------------------------------------------------------------------
export type MembershipNicknameSource = {
  spaceNicknames: Record<string, string | undefined>;
  profileDefaultNickname: string | null | undefined;
  username: string | null | undefined;
  displayName: string | null | undefined;
};

export function resolveMembershipNickname(
  source: MembershipNicknameSource,
  spaceId: string,
): string | null {
  const candidates = [
    source.spaceNicknames[spaceId],
    source.profileDefaultNickname,
    source.username,
    source.displayName,
  ];
  for (const c of candidates) {
    const trimmed = c?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}
