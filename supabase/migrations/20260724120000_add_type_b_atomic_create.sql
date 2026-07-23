-- ============================================================================
-- add_type_b_atomic_create  (126 Type B TB-2)
-- ----------------------------------------------------------------------------
-- Type B v1: authenticated member / personal owner / admin only.
-- Atomic post + connection in create_type_b_connected_hossii RPC.
-- guest / anon write deferred to v2.
--
-- Development / test DB only until explicitly promoted to Production.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. origin_hossii_id on hossii_connections
-- ---------------------------------------------------------------------------
ALTER TABLE public.hossii_connections
  ADD COLUMN IF NOT EXISTS origin_hossii_id text NULL
    REFERENCES public.hossiis(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.hossii_connections.origin_hossii_id IS
  'Type B 起点 hossii。NULL = Type A。作成後は変更不可。';

ALTER TABLE public.hossii_connections
  DROP CONSTRAINT IF EXISTS hossii_connections_origin_endpoint;

ALTER TABLE public.hossii_connections
  ADD CONSTRAINT hossii_connections_origin_endpoint CHECK (
    origin_hossii_id IS NULL
    OR origin_hossii_id = source_hossii_id
    OR origin_hossii_id = target_hossii_id
  );

CREATE INDEX IF NOT EXISTS hossii_connections_origin_hossii_id_idx
  ON public.hossii_connections (origin_hossii_id)
  WHERE origin_hossii_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. idempotency table (RPC-only access)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.type_b_create_idempotency (
  idempotency_key uuid        NOT NULL,
  auth_user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload_hash    bytea       NOT NULL,
  new_hossii_id   text        NOT NULL,
  connection_id   uuid        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (idempotency_key, auth_user_id)
);

CREATE INDEX IF NOT EXISTS type_b_create_idempotency_created_at_idx
  ON public.type_b_create_idempotency (created_at);

ALTER TABLE public.type_b_create_idempotency ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.type_b_create_idempotency FROM PUBLIC;
REVOKE ALL ON public.type_b_create_idempotency FROM anon, authenticated;

COMMENT ON TABLE public.type_b_create_idempotency IS
  'Type B create RPC idempotency store. Client direct access denied; no TTL cleanup in v1.';

-- ---------------------------------------------------------------------------
-- 3. guard_hossii_connection_row — origin validation + immutability
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_hossii_connection_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tmp text;
  v_src_space text;
  v_tgt_space text;
  v_src_pane text;
  v_tgt_pane text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.assert_space_not_archived_for_write(OLD.space_id);
    RETURN OLD;
  END IF;

  PERFORM public.assert_space_not_archived_for_write(NEW.space_id);

  IF NEW.source_hossii_id > NEW.target_hossii_id THEN
    v_tmp := NEW.source_hossii_id;
    NEW.source_hossii_id := NEW.target_hossii_id;
    NEW.target_hossii_id := v_tmp;
  END IF;

  IF NEW.source_hossii_id = NEW.target_hossii_id THEN
    RAISE EXCEPTION 'cannot connect hossii to itself';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSIF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    NEW.created_by := OLD.created_by;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.origin_hossii_id IS DISTINCT FROM OLD.origin_hossii_id THEN
    NEW.origin_hossii_id := OLD.origin_hossii_id;
  END IF;

  IF NEW.origin_hossii_id IS NOT NULL
     AND NEW.origin_hossii_id <> NEW.source_hossii_id
     AND NEW.origin_hossii_id <> NEW.target_hossii_id THEN
    RAISE EXCEPTION 'origin_hossii_id must be source or target endpoint';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.space_panes p
    WHERE p.id = NEW.pane_id
      AND p.space_id = NEW.space_id
  ) THEN
    RAISE EXCEPTION 'pane_id does not belong to space_id';
  END IF;

  SELECT h.space_id, COALESCE(h.space_pane_id, h.space_id || '-pane-default')
  INTO v_src_space, v_src_pane
  FROM public.hossiis h
  WHERE h.id = NEW.source_hossii_id
    AND h.deleted_at IS NULL
    AND COALESCE(h.is_hidden, false) = false;

  IF v_src_space IS NULL THEN
    RAISE EXCEPTION 'source hossii is not available for connection';
  END IF;

  SELECT h.space_id, COALESCE(h.space_pane_id, h.space_id || '-pane-default')
  INTO v_tgt_space, v_tgt_pane
  FROM public.hossiis h
  WHERE h.id = NEW.target_hossii_id
    AND h.deleted_at IS NULL
    AND COALESCE(h.is_hidden, false) = false;

  IF v_tgt_space IS NULL THEN
    RAISE EXCEPTION 'target hossii is not available for connection';
  END IF;

  IF v_src_space <> NEW.space_id OR v_tgt_space <> NEW.space_id THEN
    RAISE EXCEPTION 'both hossiis must belong to connection space_id';
  END IF;

  IF v_src_space <> v_tgt_space THEN
    RAISE EXCEPTION 'hossiis must belong to the same space';
  END IF;

  IF v_src_pane <> NEW.pane_id OR v_tgt_pane <> NEW.pane_id THEN
    RAISE EXCEPTION 'both hossiis must belong to connection pane_id';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_hossii_connection_row() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 4. helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.type_b_message_max_length()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT 200;
$$;

REVOKE ALL ON FUNCTION public.type_b_message_max_length() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.type_b_message_max_length() TO authenticated;

CREATE OR REPLACE FUNCTION public.type_b_compute_payload_hash(
  p_space_id text,
  p_pane_id text,
  p_origin_hossii_id text,
  p_new_hossii_id text,
  p_message text,
  p_position_x double precision,
  p_position_y double precision,
  p_emotion text
)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT extensions.digest(
    convert_to(
      concat_ws(
        '\x1e',
        coalesce(p_space_id, ''),
        coalesce(p_pane_id, ''),
        coalesce(p_origin_hossii_id, ''),
        coalesce(p_new_hossii_id, ''),
        coalesce(p_message, ''),
        coalesce(p_position_x::text, ''),
        coalesce(p_position_y::text, ''),
        coalesce(p_emotion, '')
      ),
      'UTF8'
    ),
    'sha256'
  );
$$;

REVOKE ALL ON FUNCTION public.type_b_compute_payload_hash(text, text, text, text, text, double precision, double precision, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.type_b_validate_position(
  p_position_x double precision,
  p_position_y double precision
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_position_x IS NULL OR p_position_y IS NULL THEN
    RAISE EXCEPTION 'position_x and position_y are required';
  END IF;

  IF p_position_x <> p_position_x OR p_position_y <> p_position_y THEN
    RAISE EXCEPTION 'position must be finite numbers';
  END IF;

  IF p_position_x < 0 OR p_position_x > 100 OR p_position_y < 0 OR p_position_y > 100 THEN
    RAISE EXCEPTION 'position must be between 0 and 100';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.type_b_validate_position(double precision, double precision) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 5. create_type_b_connected_hossii RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_type_b_connected_hossii(
  p_idempotency_key    uuid,
  p_space_id           text,
  p_pane_id            text,
  p_origin_hossii_id   text,
  p_new_hossii_id      text,
  p_message            text,
  p_position_x         double precision,
  p_position_y         double precision,
  p_emotion            text DEFAULT NULL,
  p_author_id          text DEFAULT NULL,
  p_author_name        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_message text;
  v_payload_hash bytea;
  v_origin_space text;
  v_origin_pane text;
  v_connection_id uuid;
  v_existing record;
  v_max_message integer := public.type_b_message_max_length();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  IF p_space_id IS NULL OR btrim(p_space_id) = '' THEN
    RAISE EXCEPTION 'space_id is required';
  END IF;

  IF p_pane_id IS NULL OR btrim(p_pane_id) = '' THEN
    RAISE EXCEPTION 'pane_id is required';
  END IF;

  IF p_origin_hossii_id IS NULL OR btrim(p_origin_hossii_id) = '' THEN
    RAISE EXCEPTION 'origin_hossii_id is required';
  END IF;

  IF p_new_hossii_id IS NULL OR btrim(p_new_hossii_id) = '' THEN
    RAISE EXCEPTION 'new_hossii_id is required';
  END IF;

  IF p_origin_hossii_id = p_new_hossii_id THEN
    RAISE EXCEPTION 'origin and new hossii must differ';
  END IF;

  PERFORM public.assert_space_not_archived_for_write(p_space_id);

  IF NOT public.can_access_space(p_space_id) THEN
    RAISE EXCEPTION 'space is not accessible';
  END IF;

  IF NOT public.can_create_hossii_connection(p_space_id) THEN
    RAISE EXCEPTION 'not allowed to create connections in this space';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.space_panes p
    WHERE p.id = p_pane_id
      AND p.space_id = p_space_id
  ) THEN
    RAISE EXCEPTION 'pane_id does not belong to space_id';
  END IF;

  v_message := btrim(coalesce(p_message, ''));
  IF v_message = '' THEN
    RAISE EXCEPTION 'message must not be empty';
  END IF;

  IF char_length(v_message) > v_max_message THEN
    RAISE EXCEPTION 'message exceeds maximum length of % characters', v_max_message;
  END IF;

  IF p_emotion IS NOT NULL
     AND p_emotion NOT IN ('wow', 'empathy', 'inspire', 'think', 'laugh', 'joy', 'moved', 'fun') THEN
    RAISE EXCEPTION 'invalid emotion';
  END IF;

  PERFORM public.type_b_validate_position(p_position_x, p_position_y);

  v_payload_hash := public.type_b_compute_payload_hash(
    p_space_id,
    p_pane_id,
    p_origin_hossii_id,
    p_new_hossii_id,
    v_message,
    p_position_x,
    p_position_y,
    p_emotion
  );

  SELECT i.new_hossii_id, i.connection_id, i.payload_hash
  INTO v_existing
  FROM public.type_b_create_idempotency i
  WHERE i.idempotency_key = p_idempotency_key
    AND i.auth_user_id = v_uid;

  IF FOUND THEN
    IF v_existing.payload_hash <> v_payload_hash THEN
      RAISE EXCEPTION 'idempotency key reused with different payload';
    END IF;

    RETURN jsonb_build_object(
      'new_hossii_id', v_existing.new_hossii_id,
      'connection_id', v_existing.connection_id,
      'origin_hossii_id', p_origin_hossii_id,
      'idempotent_replay', true
    );
  END IF;

  IF EXISTS (SELECT 1 FROM public.hossiis h WHERE h.id = p_new_hossii_id) THEN
    RAISE EXCEPTION 'new_hossii_id already exists';
  END IF;

  SELECT h.space_id, COALESCE(h.space_pane_id, h.space_id || '-pane-default')
  INTO v_origin_space, v_origin_pane
  FROM public.hossiis h
  WHERE h.id = p_origin_hossii_id
    AND h.deleted_at IS NULL
    AND COALESCE(h.is_hidden, false) = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'origin hossii is not available';
  END IF;

  IF v_origin_space <> p_space_id OR v_origin_pane <> p_pane_id THEN
    RAISE EXCEPTION 'origin hossii must belong to requested space and pane';
  END IF;

  IF NOT public.hossii_connection_endpoint_readable(p_origin_hossii_id) THEN
    RAISE EXCEPTION 'origin hossii is not readable';
  END IF;

  INSERT INTO public.hossiis (
    id,
    message,
    emotion,
    space_id,
    space_pane_id,
    author_id,
    author_name,
    origin,
    auto_type,
    speech_level,
    language,
    log_type,
    created_at,
    bubble_color,
    hashtags,
    image_url,
    position_x,
    position_y,
    is_position_fixed,
    scale,
    is_hidden,
    hidden_at,
    hidden_by,
    number_value,
    like_count
  ) VALUES (
    p_new_hossii_id,
    v_message,
    p_emotion,
    p_space_id,
    p_pane_id,
    p_author_id,
    p_author_name,
    'manual',
    NULL,
    NULL,
    NULL,
    NULL,
    now(),
    NULL,
    NULL,
    NULL,
    p_position_x,
    p_position_y,
    false,
    1.0,
    false,
    NULL,
    NULL,
    NULL,
    0
  );

  INSERT INTO public.hossii_connections (
    space_id,
    pane_id,
    source_hossii_id,
    target_hossii_id,
    strength,
    origin_hossii_id,
    reason_text,
    reason_emoji
  ) VALUES (
    p_space_id,
    p_pane_id,
    p_origin_hossii_id,
    p_new_hossii_id,
    'medium',
    p_origin_hossii_id,
    NULL,
    NULL
  )
  RETURNING id INTO v_connection_id;

  INSERT INTO public.type_b_create_idempotency (
    idempotency_key,
    auth_user_id,
    payload_hash,
    new_hossii_id,
    connection_id
  ) VALUES (
    p_idempotency_key,
    v_uid,
    v_payload_hash,
    p_new_hossii_id,
    v_connection_id
  );

  RETURN jsonb_build_object(
    'new_hossii_id', p_new_hossii_id,
    'connection_id', v_connection_id,
    'origin_hossii_id', p_origin_hossii_id,
    'idempotent_replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_type_b_connected_hossii(
  uuid, text, text, text, text, text, double precision, double precision, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_type_b_connected_hossii(
  uuid, text, text, text, text, text, double precision, double precision, text, text, text
) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_type_b_connected_hossii(
  uuid, text, text, text, text, text, double precision, double precision, text, text, text
) TO authenticated;

COMMENT ON FUNCTION public.create_type_b_connected_hossii IS
  'Type B v1: atomic new hossii + medium-strength connection from origin. authenticated only.';

-- ---------------------------------------------------------------------------
-- 6. dev-only rollback semantics probe (service_role verification)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dev_test_type_b_transaction_rollback()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.hossii_connections
  WHERE source_hossii_id = 'dev-tb2-rollback-probe'
     OR target_hossii_id = 'dev-tb2-rollback-probe';

  DELETE FROM public.hossiis
  WHERE id = 'dev-tb2-rollback-probe';

  INSERT INTO public.hossiis (
    id,
    message,
    space_id,
    space_pane_id,
    author_name,
    origin,
    created_at,
    like_count,
    is_position_fixed,
    scale,
    is_hidden
  ) VALUES (
    'dev-tb2-rollback-probe',
    'rollback probe',
    'dev-space-public',
    'dev-space-public-pane-default',
    'rollback-test',
    'manual',
    now(),
    0,
    false,
    1.0,
    false
  );

  INSERT INTO public.hossii_connections (
    space_id,
    pane_id,
    source_hossii_id,
    target_hossii_id,
    strength,
    origin_hossii_id
  ) VALUES (
    'dev-space-public',
    'dev-space-public-pane-default',
    'dev-post-001',
    'dev-tb2-rollback-probe',
    'medium',
    'dev-post-not-an-endpoint'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dev_test_type_b_transaction_rollback() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dev_test_type_b_transaction_rollback() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dev_test_type_b_transaction_rollback() TO service_role;
