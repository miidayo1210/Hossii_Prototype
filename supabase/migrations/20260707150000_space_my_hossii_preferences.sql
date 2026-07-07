-- スペース別マイHossii登場設定（本人のみ制御）
-- ロールバック:
--   DROP FUNCTION IF EXISTS public.list_my_hossii_participants(text);
--   （20260707140000 の定義を再適用）
--   DROP TABLE IF EXISTS public.space_my_hossii_preferences;

CREATE TABLE IF NOT EXISTS public.space_my_hossii_preferences (
  space_id   TEXT        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_visible BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, user_id)
);

CREATE INDEX IF NOT EXISTS space_my_hossii_preferences_user_id_idx
  ON public.space_my_hossii_preferences (user_id);

ALTER TABLE public.space_my_hossii_preferences ENABLE ROW LEVEL SECURITY;

-- 本人のみ読み取り
CREATE POLICY "user read own my hossii space preference"
  ON public.space_my_hossii_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- 本人のみ作成
CREATE POLICY "user insert own my hossii space preference"
  ON public.space_my_hossii_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 本人のみ更新（管理者は本人の意思に反して ON にできない）
CREATE POLICY "user update own my hossii space preference"
  ON public.space_my_hossii_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 発行参加者が自分の参加状態を確認できるようにする
CREATE POLICY "user read own space_participant_account"
  ON public.space_participant_accounts
  FOR SELECT
  USING (auth_user_id = auth.uid());

-- RPC: 本人のスペース別設定を反映（行なしは ON 扱い）
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
  LEFT JOIN public.space_my_hossii_preferences pref
    ON pref.space_id = p_space_id
   AND pref.user_id = d.user_id
  WHERE up.hossii_source_type IS NOT NULL
    AND (
      up.hossii_source_type <> 'preset'
      OR up.hossii_preset_key IS NOT NULL
    )
    AND (
      up.hossii_source_type <> 'upload'
      OR up.hossii_image_path IS NOT NULL
    )
    AND COALESCE(pref.is_visible, true) = true;
$$;

REVOKE ALL ON FUNCTION public.list_my_hossii_participants(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_hossii_participants(text) TO anon, authenticated;
