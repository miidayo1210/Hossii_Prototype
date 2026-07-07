-- Phase 6A: マイHossiiカスタム設定の基盤（パーツ画像なし・設定JSONのみ）
-- ロールバック:
--   ALTER TABLE user_profiles DROP COLUMN IF EXISTS hossii_custom_config;
--   （hossii_source_type CHECK を preset/upload のみに戻す）

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_hossii_source_type_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_hossii_source_type_check
  CHECK (hossii_source_type IS NULL OR hossii_source_type IN ('preset', 'upload', 'custom'));

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS hossii_custom_config jsonb;

COMMENT ON COLUMN public.user_profiles.hossii_custom_config IS
  'マイHossiiカスタム設定（Phase 6A）。version/baseKey/parts を保持';

-- custom 登録済みも参加者 RPC に含める（baseKey が有効プリセットのとき）
CREATE OR REPLACE FUNCTION public.list_my_hossii_participants(p_space_id text)
RETURNS TABLE (
  user_id uuid,
  nickname text,
  hossii_source_type text,
  hossii_preset_key text,
  hossii_image_path text,
  hossii_updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH space_gate AS (
    SELECT s.id
    FROM public.spaces s
    WHERE s.id = p_space_id
      AND (
        COALESCE(s.is_private, false) = false
        OR auth.uid() IS NOT NULL
      )
  ),
  candidates AS (
    SELECT
      up.id AS user_id,
      NULLIF(btrim(sn.nickname), '') AS nickname
    FROM space_gate sg
    INNER JOIN public.space_nicknames sn
      ON sn.space_id = sg.id
    INNER JOIN public.user_profiles up
      ON up.id::text = sn.profile_id

    UNION ALL

    SELECT
      spa.auth_user_id AS user_id,
      COALESCE(
        NULLIF(btrim(sn.nickname), ''),
        NULLIF(btrim(p.default_nickname), ''),
        NULLIF(btrim(up.username), ''),
        ''
      ) AS nickname
    FROM space_gate sg
    INNER JOIN public.space_participant_accounts spa
      ON spa.space_id = sg.id
    INNER JOIN public.user_profiles up
      ON up.id = spa.auth_user_id
    LEFT JOIN public.space_nicknames sn
      ON sn.space_id = sg.id
     AND sn.profile_id = spa.auth_user_id::text
    LEFT JOIN public.profiles p
      ON p.id = spa.auth_user_id::text
    WHERE spa.status = 'active'
  ),
  deduped AS (
    SELECT DISTINCT ON (c.user_id)
      c.user_id,
      c.nickname
    FROM candidates c
    ORDER BY c.user_id, (c.nickname IS NOT NULL AND c.nickname <> '') DESC, c.nickname
  )
  SELECT
    d.user_id,
    COALESCE(NULLIF(btrim(d.nickname), ''), NULLIF(btrim(up.username), ''), 'ユーザー') AS nickname,
    up.hossii_source_type,
    COALESCE(
      up.hossii_preset_key,
      NULLIF(up.hossii_custom_config ->> 'baseKey', '')
    ) AS hossii_preset_key,
    up.hossii_image_path,
    up.hossii_updated_at
  FROM deduped d
  INNER JOIN public.user_profiles up
    ON up.id = d.user_id
  LEFT JOIN public.space_my_hossii_preferences pref
    ON pref.space_id = p_space_id
   AND pref.user_id = d.user_id
  WHERE up.hossii_source_type IS NOT NULL
    AND (
      (
        up.hossii_source_type = 'preset'
        AND up.hossii_preset_key IS NOT NULL
      )
      OR (
        up.hossii_source_type = 'upload'
        AND up.hossii_image_path IS NOT NULL
      )
      OR (
        up.hossii_source_type = 'custom'
        AND NULLIF(up.hossii_custom_config ->> 'baseKey', '') IS NOT NULL
      )
    )
    AND COALESCE(pref.is_visible, true) = true;
$$;

REVOKE ALL ON FUNCTION public.list_my_hossii_participants(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_hossii_participants(text) TO anon, authenticated;
