-- ============================================================================
-- backfill_missing_community_memberships  (115 カテゴリ A: 既存欠損の補完)
-- ----------------------------------------------------------------------------
-- 目的:
--   active な space_memberships があるのに community_memberships が無い
--   user/community ペアへ、不足分のみ member/active を追加する。
--
-- 対象:
--   - space_memberships.status = 'active'
--   - spaces.community_id IS NOT NULL
--   - 同一 (auth_user_id, community_id) の community_memberships が不存在
--
-- 安全:
--   - INSERT のみ（既存行は UPDATE しない）
--   - ON CONFLICT (community_id, auth_user_id) DO NOTHING
--   - DISTINCT で user/community あたり 1 行
--   - suspended / removed / invited は触らない（存在時は no-op）
--   - DELETE / 破壊的変更なし
--
-- 安全性: append-only。development / production 双方で冪等に再実行可。
-- ============================================================================

INSERT INTO public.community_memberships (community_id, auth_user_id, role, status, accepted_at)
SELECT DISTINCT s.community_id, sm.auth_user_id, 'member', 'active', now()
FROM public.space_memberships sm
JOIN public.spaces s ON s.id = sm.space_id
WHERE sm.status = 'active'
  AND s.community_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.community_memberships cm
    WHERE cm.community_id = s.community_id
      AND cm.auth_user_id = sm.auth_user_id
  )
ON CONFLICT (community_id, auth_user_id) DO NOTHING;
