#!/usr/bin/env python3
"""Verify jsonb→text[] tags conversion migration against Development only."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MIGRATION = (
    REPO
    / "supabase/migrations/20260724210000_convert_hossiis_tags_jsonb_to_text_array.sql"
)
DEV_REF = "uodaubhlcvvqlgsdxcdf"


def load_pg_env() -> dict[str, str]:
    linked = (REPO / "supabase/.temp/project-ref").read_text().strip()
    if linked != DEV_REF:
        raise SystemExit(f"Refusing: CLI linked to {linked}, expected Development {DEV_REF}")

    dry = subprocess.run(
        ["supabase", "db", "dump", "--dry-run", "--linked"],
        cwd=REPO,
        capture_output=True,
        text=True,
    )
    if dry.returncode != 0:
        sys.stderr.write(dry.stderr or dry.stdout)
        raise SystemExit(dry.returncode)

    env = dict(re.findall(r'export (PG\w+)="([^"]*)"', dry.stdout))
    if DEV_REF not in env.get("PGUSER", ""):
        raise SystemExit(f"Refusing unexpected PGUSER={env.get('PGUSER')}")
    return env


def main() -> None:
    try:
        import pg8000
    except ImportError:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "--user", "pg8000", "-q"]
        )
        import pg8000

    env = load_pg_env()
    conn = pg8000.connect(
        host=env["PGHOST"],
        port=int(env["PGPORT"]),
        user=env["PGUSER"],
        password=env["PGPASSWORD"],
        database=env["PGDATABASE"],
        ssl_context=True,
    )
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SET SESSION ROLE postgres")

    cur.execute(
        """
        SELECT c.udt_name, c.is_nullable, c.column_default
        FROM information_schema.columns c
        WHERE c.table_schema='public' AND c.table_name='hossiis' AND c.column_name='tags'
        """
    )
    before_meta = cur.fetchone()
    print("before_meta", before_meta)
    assert before_meta and before_meta[0] == "_text", before_meta

    cur.execute(
        """
        SELECT
          count(*) FILTER (WHERE tags IS NULL),
          count(*) FILTER (WHERE tags = '{}'),
          count(*)
        FROM public.hossiis
        """
    )
    before_counts = cur.fetchone()
    print("before_counts null/empty/total", before_counts)

    cur.execute(MIGRATION.read_text())
    print("migration applied (expected no-op for text[])")

    cur.execute(
        """
        SELECT c.udt_name, c.is_nullable, c.column_default
        FROM information_schema.columns c
        WHERE c.table_schema='public' AND c.table_name='hossiis' AND c.column_name='tags'
        """
    )
    after_meta = cur.fetchone()
    print("after_meta", after_meta)
    assert after_meta[0] == "_text"
    assert after_meta[1] == "YES"
    assert after_meta[2] and "{}" in after_meta[2]

    cur.execute(
        """
        SELECT
          count(*) FILTER (WHERE tags IS NULL),
          count(*) FILTER (WHERE tags = '{}'),
          count(*)
        FROM public.hossiis
        """
    )
    after_counts = cur.fetchone()
    print("after_counts null/empty/total", after_counts)
    assert before_counts == after_counts, (before_counts, after_counts)
    print("PART_A_OK")

    cur.execute(
        "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=%s",
        ("20260724210000",),
    )
    if cur.fetchone() is None:
        cur.execute(
            "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES (%s, %s)",
            ("20260724210000", "convert_hossiis_tags_jsonb_to_text_array"),
        )
        print("recorded schema_migrations 20260724210000")
    else:
        print("schema_migrations already has 20260724210000")

    # Part B — jsonb reproduction (TEMP)
    cur.execute("DROP TABLE IF EXISTS tags_jsonb_repro")
    cur.execute(
        "CREATE TEMP TABLE tags_jsonb_repro (id text PRIMARY KEY, tags jsonb)"
    )
    cur.execute(
        """
        INSERT INTO tags_jsonb_repro (id, tags) VALUES
          ('null', NULL),
          ('empty', '[]'::jsonb),
          ('one', '["質問"]'::jsonb),
          ('multi', '["質問", "感想"]'::jsonb),
          ('dup', '["a", "a"]'::jsonb),
          ('jp_mixed', '["アイデア", "idea"]'::jsonb)
        """
    )

    cur.execute(
        """
        SELECT count(*) FROM tags_jsonb_repro
        WHERE tags IS NOT NULL AND jsonb_typeof(tags) <> 'array'
        """
    )
    assert cur.fetchone()[0] == 0
    cur.execute(
        """
        SELECT count(*) FROM tags_jsonb_repro
        WHERE jsonb_typeof(tags) = 'array'
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(tags) AS e(value)
            WHERE jsonb_typeof(e.value) <> 'string'
          )
        """
    )
    assert cur.fetchone()[0] == 0

    cur.execute("DROP TABLE IF EXISTS tags_convert_result")
    cur.execute(
        "CREATE TEMP TABLE tags_convert_result (id text PRIMARY KEY, tags text[])"
    )
    cur.execute(
        """
        INSERT INTO tags_convert_result (id, tags)
        SELECT id,
          CASE
            WHEN tags IS NULL THEN NULL
            ELSE ARRAY(SELECT jsonb_array_elements_text(tags))
          END
        FROM tags_jsonb_repro
        """
    )

    def get(i: str):
        cur.execute("SELECT tags FROM tags_convert_result WHERE id=%s", (i,))
        return cur.fetchone()[0]

    assert get("null") is None
    assert get("empty") == []
    assert get("one") == ["質問"]
    assert get("multi") == ["質問", "感想"]
    assert get("dup") == ["a", "a"]
    assert get("jp_mixed") == ["アイデア", "idea"]
    print("PART_B_GOOD_PATH_OK")

    cur.execute(
        """
        SELECT count(*) FROM (VALUES ('{"a":1}'::jsonb)) AS t(tags)
        WHERE tags IS NOT NULL AND jsonb_typeof(tags) <> 'array'
        """
    )
    assert cur.fetchone()[0] == 1
    print("PART_B_NON_ARRAY_DETECT_OK")

    cur.execute(
        """
        SELECT EXISTS (
          SELECT 1 FROM jsonb_array_elements('[1, "x"]'::jsonb) AS e(value)
          WHERE jsonb_typeof(e.value) <> 'string'
        )
        """
    )
    assert cur.fetchone()[0] is True
    print("PART_B_NON_STRING_DETECT_OK")

    # ALTER TYPE USING cannot embed subqueries; migration uses a temp SQL function.
    cur.execute(
        """
        CREATE OR REPLACE FUNCTION pg_temp.hossii_tags_jsonb_to_text_array(j jsonb)
        RETURNS text[]
        LANGUAGE sql
        IMMUTABLE
        AS $fn$
          SELECT CASE
            WHEN j IS NULL THEN NULL
            ELSE ARRAY(SELECT jsonb_array_elements_text(j))
          END;
        $fn$
        """
    )
    cur.execute("DROP TABLE IF EXISTS tags_jsonb_alter")
    cur.execute(
        "CREATE TEMP TABLE tags_jsonb_alter (id text PRIMARY KEY, tags jsonb DEFAULT '[]'::jsonb)"
    )
    cur.execute(
        """
        INSERT INTO tags_jsonb_alter (id, tags) VALUES
          ('n', NULL), ('e', '[]'::jsonb), ('m', '["x","y"]'::jsonb)
        """
    )
    cur.execute("ALTER TABLE tags_jsonb_alter ALTER COLUMN tags DROP DEFAULT")
    cur.execute(
        """
        ALTER TABLE tags_jsonb_alter
          ALTER COLUMN tags TYPE text[]
          USING pg_temp.hossii_tags_jsonb_to_text_array(tags)
        """
    )
    cur.execute("ALTER TABLE tags_jsonb_alter ALTER COLUMN tags SET DEFAULT '{}'")
    cur.execute("SELECT id, tags FROM tags_jsonb_alter ORDER BY id")
    rows = {r[0]: r[1] for r in cur.fetchall()}
    print("alter_rows", rows)
    assert rows["n"] is None
    assert rows["e"] == []
    assert rows["m"] == ["x", "y"]
    print("PART_B_ALTER_TYPE_OK")

    refused = False
    try:
        cur.execute(
            """
            DO $body$
            BEGIN
              RAISE EXCEPTION
                'hossiis.tags has % row(s) with non-array jsonb; refusing conversion to text[]',
                1;
            END
            $body$;
            """
        )
    except Exception:
        refused = True
    assert refused
    print("PART_B_EXCEPTION_PATH_OK")

    # Already-text[] path on temp table (no-op style)
    cur.execute("DROP TABLE IF EXISTS tags_text_already")
    cur.execute(
        "CREATE TEMP TABLE tags_text_already (id text PRIMARY KEY, tags text[] DEFAULT '{}')"
    )
    cur.execute(
        "INSERT INTO tags_text_already (id, tags) VALUES ('a', ARRAY['keep']::text[])"
    )
    cur.execute("ALTER TABLE tags_text_already ALTER COLUMN tags SET DEFAULT '{}'")
    cur.execute("SELECT tags FROM tags_text_already WHERE id='a'")
    assert cur.fetchone()[0] == ["keep"]
    print("PART_B_ALREADY_TEXT_OK")

    cur.close()
    conn.close()
    print("ALL_VERIFY_OK")


if __name__ == "__main__":
    main()
