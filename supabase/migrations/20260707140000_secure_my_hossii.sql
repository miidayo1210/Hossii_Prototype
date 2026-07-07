-- セキュリティ修正: マイHossii関連のDB制約とRPC更新

-- 1. hossii_image_path は本人の avatars/{uid}/my-hossii.webp のみ許可
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_hossii_image_path_owner;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_hossii_image_path_owner
  CHECK (
    hossii_image_path IS NULL
    OR hossii_image_path = 'avatars/' || id::text || '/my-hossii.webp'
  );

-- 2. my_hossii スペース設定はコミュニティ管理者または super_admin のみ更新可
CREATE OR REPLACE FUNCTION public.enforce_my_hossii_space_settings_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    OLD.my_hossii_enabled IS DISTINCT FROM NEW.my_hossii_enabled
    OR OLD.my_hossii_motion_mode IS DISTINCT FROM NEW.my_hossii_motion_mode
    OR OLD.my_hossii_log_visibility IS DISTINCT FROM NEW.my_hossii_log_visibility
  ) THEN
    IF (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin' THEN
      RETURN NEW;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.spaces s
      INNER JOIN public.communities c ON c.id = s.community_id
      WHERE s.id = NEW.id
        AND c.admin_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'my_hossii space settings require community admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_my_hossii_space_settings_admin ON public.spaces;

CREATE TRIGGER enforce_my_hossii_space_settings_admin
  BEFORE UPDATE ON public.spaces
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_my_hossii_space_settings_admin();

-- 3. RPC: 存在しないスペースと非公開スペースへの anon アクセスを拒否
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
