-- ============================================================================
-- add_update_my_space_nickname_rpc  (Phase 2F: 本人によるスペースニックネーム変更)
-- ----------------------------------------------------------------------------
-- 目的:
--   アカウントページの「参加しているスペース」一覧から、ログイン本人が自分の
--   space_memberships.space_nickname を安全に変更できるようにする。
--
-- なぜ RPC か:
--   space_memberships の UPDATE policy（20260713110000）はスペース管理者・super_admin
--   のみに限定されており、一般ユーザーは自分の行でも直接 UPDATE できない（＝自己昇格・
--   他人書き換えを防ぐ設計）。本人のニックネームだけを安全に変えるため、変更列を
--   space_nickname に限定した SECURITY DEFINER RPC を追加する。
--
-- 安全性・制約:
--   - SECURITY DEFINER / SET search_path = ''（全オブジェクト schema 修飾）。
--   - auth.uid() を正本とし、引数で auth_user_id を受け取らない（なりすまし不可）。
--   - 更新対象は WHERE auth_user_id = auth.uid() の本人 membership のみ。
--   - SET は space_nickname だけ。role / status / community / space_id は変更しない。
--   - anon（ゲスト）には EXECUTE を付与しない（authenticated のみ）。
--   - PII は返さない（正規化後のニックネーム文字列のみを返す）。
--   - 既存テーブル・既存 policy・既存 migration を変更しない（append-only / 新規関数のみ）。
--   - development のみ適用。production 未操作。破壊的変更なし。
--
-- ニックネーム正規化ルール（クライアント側 spaceNicknameRules.ts と一致させる）:
--   - 前後空白を trim。
--   - 空文字は NULL（＝スペース別ニックネーム未設定。デフォルト名にフォールバック）。
--   - 50 文字超は拒否。
--   - 制御文字（[[:cntrl:]]）を含む場合は拒否。
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_my_space_nickname(
  p_space_id       text,
  p_space_nickname text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_nickname text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'update_my_space_nickname: not authenticated';
  END IF;

  v_nickname := btrim(coalesce(p_space_nickname, ''));

  IF v_nickname = '' THEN
    v_nickname := NULL;
  ELSE
    IF char_length(v_nickname) > 50 THEN
      RAISE EXCEPTION 'update_my_space_nickname: nickname too long';
    END IF;
    IF v_nickname ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'update_my_space_nickname: nickname contains control characters';
    END IF;
  END IF;

  UPDATE public.space_memberships m
  SET space_nickname = v_nickname
  WHERE m.space_id = p_space_id
    AND m.auth_user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'update_my_space_nickname: membership not found for current user';
  END IF;

  RETURN v_nickname;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_space_nickname(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_my_space_nickname(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_my_space_nickname(text, text) TO authenticated;
