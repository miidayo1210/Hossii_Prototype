-- ============================================================================
-- restrict_community_audit_log_helper  (Phase 6 リリース候補監査 修正)
-- ----------------------------------------------------------------------------
-- 問題:
--   内部ヘルパ public._community_audit_log(...) が PUBLIC / anon / authenticated
--   に EXECUTE を持っていた（20260715100000 で REVOKE していなかった）。
--   この関数は actor / community / action を引数で受け取り信用するため、
--   authenticated ユーザが有効な action と実在 actor id を指定して
--   audit log 行を直接 forge できた（監査整合性の侵害）。
--
-- 修正:
--   _community_audit_log の EXECUTE を PUBLIC / anon / authenticated から剥奪する。
--   この関数は SECURITY DEFINER の各 RPC（invite 作成/受諾, membership 管理 等）
--   からのみ呼ばれる。呼び出し元 RPC は definer（postgres）権限で実行されるため、
--   内部呼び出しは引き続き成功する（クライアント直接呼び出しのみ遮断される）。
--
-- 安全性: GRANT/REVOKE のみ。append-only。destructive DML なし。development のみ。
-- ============================================================================

REVOKE ALL ON FUNCTION public._community_audit_log(uuid, text, uuid, uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._community_audit_log(uuid, text, uuid, uuid, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public._community_audit_log(uuid, text, uuid, uuid, uuid, jsonb) FROM authenticated;
