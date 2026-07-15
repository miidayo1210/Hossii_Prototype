-- ============================================================================
-- add_personal_space_templates  (Phase 4: 個人スペーステンプレート)
-- ----------------------------------------------------------------------------
-- 目的（109 §11）:
--   コミュニティ管理者が、個人スペースの初期構成（名前・背景・初期タブ・投稿設定）を
--   テンプレートとして定義できるようにする。個人スペース「作成時にコピー」する方式で、
--   既存の個人スペースへは自動反映しない。巨大な template engine は作らず、既存の
--   spaces / space_panes / space_settings 構造をそのまま再利用する（案A: 最小）。
--
-- テンプレートの所属: community（communities.personal_space_template jsonb）。
--   形（すべて任意 / 後方互換のため未知キーは無視）:
--     {
--       "enabled": true,
--       "name_pattern": "ふりかえりスペース",         -- spaces.name の初期値
--       "background": { "kind": "pattern", "value": "mist" },  -- spaces.background
--       "space_settings": {                            -- space_settings の一部（投稿フォーム等）
--         "post_fields": { "numberPost": {"enabled": true, "required": false}, ... }
--       },
--       "panes": [                                     -- 追加タブ（default pane 以外）
--         { "name": "ふりかえり", "slug": "reflection", "sort_order": 1,
--           "is_visible": true, "background": {...}, "decorations": {...},
--           "character_image_url": "...", "character_name": "...",
--           "custom_emotions": {...}, "bubble_shape_png": "...",
--           "saved_background_images": {...}, "settings": {...} }
--       ]
--     }
--
-- 適用ルール（§11.1）:
--   - 個人スペースを「新規作成するときだけ」適用する（ensure_my_personal_space の作成分岐）。
--   - 既存の個人スペースには自動反映しない（ensure は既存を早期 return するため再適用しない）。
--   - テンプレートを後から変更しても、作成済みスペースは変わらない。
--   - コピーしてはいけないもの（投稿 / authorship / membership / owner / like /
--     moderation 履歴 / participant account / secret / audit log）は構造上一切参照しない。
--     本 RPC は「community の config jsonb を読む」だけで、他スペースから行を複製しない。
--     owner は常に呼び出し本人（auth.uid()）。
--
-- 管理: communities の UPDATE は既存 RLS（owner update communities / super_admin update
--   communities）でコミュニティ管理者・super_admin のみに限定される。一般メンバー・ゲスト・
--   他コミュニティ管理者は編集不可。読み取りも owner/super_admin のみ（既存 SELECT RLS）。
--
-- 安全性: 冪等（IF NOT EXISTS / CREATE OR REPLACE）。destructive DML なし。
--         development のみ。production 未操作。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. communities にテンプレート列を追加（案A: 最小）
-- ---------------------------------------------------------------------------
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS personal_space_template jsonb;

-- ---------------------------------------------------------------------------
-- 2. ensure_my_personal_space をテンプレート適用対応へ更新
--    Phase 3 の active-member ゲート・冪等・PII 非返却を維持しつつ、作成分岐で
--    community のテンプレート（enabled のとき）を name/background/space_settings/panes に適用する。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_my_personal_space(p_community_id uuid)
RETURNS TABLE (space_id text, space_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_space_id   text;
  v_space_url  text;
  v_tmpl       jsonb;
  v_enabled    boolean;
  v_name       text;
  v_background jsonb;
  v_pane       jsonb;
  v_pslug      text;
  v_pname      text;
  v_post_fields jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.community_memberships cm
    WHERE cm.community_id = p_community_id
      AND cm.auth_user_id = v_uid
      AND cm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'not an active member of this community';
  END IF;

  -- 既存を返す（冪等。既存にはテンプレートを再適用しない）
  SELECT s.id, s.space_url INTO v_space_id, v_space_url
  FROM public.spaces s
  WHERE s.space_type = 'personal'
    AND s.community_id = p_community_id
    AND s.owner_user_id = v_uid;
  IF FOUND THEN
    space_id := v_space_id; space_url := v_space_url;
    RETURN NEXT; RETURN;
  END IF;

  -- 安定 ID/slug
  v_space_id  := 'ps-' || substr(md5(p_community_id::text || ':' || v_uid::text), 1, 24);
  v_space_url := 'p-'  || substr(md5(p_community_id::text || ':' || v_uid::text), 1, 16);

  -- テンプレート読み込み（作成時のみ適用）
  SELECT c.personal_space_template INTO v_tmpl
  FROM public.communities c WHERE c.id = p_community_id;

  v_enabled := v_tmpl IS NOT NULL
    AND COALESCE((v_tmpl ->> 'enabled')::boolean, false) = true;

  IF v_enabled AND (v_tmpl ? 'name_pattern') AND btrim(COALESCE(v_tmpl ->> 'name_pattern', '')) <> '' THEN
    v_name := left(btrim(v_tmpl ->> 'name_pattern'), 100);
  ELSE
    v_name := '個人スペース';
  END IF;

  IF v_enabled AND jsonb_typeof(v_tmpl -> 'background') = 'object' THEN
    v_background := v_tmpl -> 'background';
  ELSE
    v_background := '{"kind":"pattern","value":"mist"}'::jsonb;
  END IF;

  INSERT INTO public.spaces (id, name, space_url, community_id, space_type, owner_user_id, status, background)
  VALUES (v_space_id, v_name, v_space_url, p_community_id, 'personal', v_uid, 'active', v_background)
  ON CONFLICT (id) DO NOTHING;

  -- 競合時も部分 UNIQUE により最終的に 1 行。再取得。
  SELECT s.id, s.space_url INTO v_space_id, v_space_url
  FROM public.spaces s
  WHERE s.space_type = 'personal'
    AND s.community_id = p_community_id
    AND s.owner_user_id = v_uid;

  -- ここから先は「今 INSERT した新規スペース」に対するテンプレート適用（既存には来ない）
  IF v_enabled THEN
    -- 投稿フォーム等（space_settings.post_fields）。既定値にテンプレートを浅いマージ。
    IF jsonb_typeof(v_tmpl -> 'space_settings') = 'object'
       AND jsonb_typeof(v_tmpl -> 'space_settings' -> 'post_fields') = 'object' THEN
      v_post_fields := '{
        "message": {"enabled": true, "required": false},
        "emotion": {"enabled": true, "required": false},
        "tags": {"enabled": true, "required": false},
        "photo": {"enabled": true, "required": false},
        "bubbleColor": {"enabled": true, "required": false},
        "bubbleShape": {"enabled": true, "required": false},
        "numberPost": {"enabled": false, "required": false}
      }'::jsonb || (v_tmpl -> 'space_settings' -> 'post_fields');

      INSERT INTO public.space_settings (space_id, post_fields)
      VALUES (v_space_id, v_post_fields)
      ON CONFLICT ON CONSTRAINT space_settings_pkey DO NOTHING;
    END IF;

    -- 追加タブ（default pane 以外）。制約に合わない要素はスキップ（部分適用より安全側）。
    IF jsonb_typeof(v_tmpl -> 'panes') = 'array' THEN
      FOR v_pane IN SELECT * FROM jsonb_array_elements(v_tmpl -> 'panes') LOOP
        v_pslug := v_pane ->> 'slug';
        v_pname := v_pane ->> 'name';
        CONTINUE WHEN v_pslug IS NULL OR v_pname IS NULL;
        CONTINUE WHEN v_pslug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$';
        CONTINUE WHEN char_length(v_pname) < 1 OR char_length(v_pname) > 30;
        CONTINUE WHEN v_pslug = 'main';  -- default pane と衝突させない

        INSERT INTO public.space_panes
          (id, space_id, name, slug, sort_order, is_default, is_visible,
           background, saved_background_images, decorations, character_image_url,
           character_name, custom_emotions, bubble_shape_png, settings)
        VALUES (
          v_space_id || '-pane-' || v_pslug,
          v_space_id,
          v_pname,
          v_pslug,
          COALESCE((v_pane ->> 'sort_order')::int, 1),
          false,
          COALESCE((v_pane ->> 'is_visible')::boolean, true),
          CASE WHEN jsonb_typeof(v_pane -> 'background') = 'object' THEN v_pane -> 'background' END,
          CASE WHEN jsonb_typeof(v_pane -> 'saved_background_images') <> 'null' THEN v_pane -> 'saved_background_images' END,
          CASE WHEN jsonb_typeof(v_pane -> 'decorations') <> 'null' THEN v_pane -> 'decorations' END,
          v_pane ->> 'character_image_url',
          v_pane ->> 'character_name',
          CASE WHEN jsonb_typeof(v_pane -> 'custom_emotions') <> 'null' THEN v_pane -> 'custom_emotions' END,
          v_pane ->> 'bubble_shape_png',
          CASE WHEN jsonb_typeof(v_pane -> 'settings') <> 'null' THEN v_pane -> 'settings' END
        )
        ON CONFLICT ON CONSTRAINT space_panes_space_id_slug_key DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  space_id := v_space_id; space_url := v_space_url;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_personal_space(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_my_personal_space(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_personal_space(uuid) TO authenticated;
