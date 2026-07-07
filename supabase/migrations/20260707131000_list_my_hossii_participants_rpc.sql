-- Phase 2: マイHossii参加者取得 RPC
-- ロールバック: DROP FUNCTION IF EXISTS list_my_hossii_participants(text);

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
  WITH candidates AS (
    SELECT
      up.id AS user_id,
      NULLIF(btrim(sn.nickname), '') AS nickname
    FROM public.space_nicknames sn
    INNER JOIN public.user_profiles up
      ON up.id::text = sn.profile_id
    WHERE sn.space_id = p_space_id

    UNION ALL

    SELECT
      spa.auth_user_id AS user_id,
      COALESCE(
        NULLIF(btrim(sn.nickname), ''),
        NULLIF(btrim(p.default_nickname), ''),
        NULLIF(btrim(up.username), ''),
        ''
      ) AS nickname
    FROM public.space_participant_accounts spa
    INNER JOIN public.user_profiles up
      ON up.id = spa.auth_user_id
    LEFT JOIN public.space_nicknames sn
      ON sn.space_id = p_space_id
     AND sn.profile_id = spa.auth_user_id::text
    LEFT JOIN public.profiles p
      ON p.id = spa.auth_user_id::text
    WHERE spa.space_id = p_space_id
      AND spa.status = 'active'
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
    up.hossii_preset_key,
    up.hossii_image_path,
    up.hossii_updated_at
  FROM deduped d
  INNER JOIN public.user_profiles up
    ON up.id = d.user_id
  WHERE up.hossii_source_type IS NOT NULL
    AND (
      up.hossii_source_type <> 'preset'
      OR up.hossii_preset_key IS NOT NULL
    )
    AND (
      up.hossii_source_type <> 'upload'
      OR up.hossii_image_path IS NOT NULL
    );
$$;

REVOKE ALL ON FUNCTION public.list_my_hossii_participants(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_hossii_participants(text) TO anon, authenticated;
