import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  '../../../supabase/migrations/20260731040000_make_challenge_response_submission_idempotent.sql',
);

describe('challenge response submission idempotency migration (static SQL)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const sqlBody = sql.replace(/--[^\n]*/g, '');

  it('replaces response path with ON CONFLICT upsert', () => {
    expect(sqlBody).toContain('CREATE OR REPLACE FUNCTION public.submit_challenge_comment_response');
    expect(sqlBody).toContain('ON CONFLICT (item_id, user_id) DO UPDATE');
    expect(sqlBody).toContain('SET comment = EXCLUDED.comment');
    expect(sqlBody).toContain('visibility = EXCLUDED.visibility');
    expect(sqlBody).toContain('(xmax = 0)');
  });

  it('keeps SECURITY DEFINER and empty search_path', () => {
    expect(sqlBody).toContain('SECURITY DEFINER');
    expect(sqlBody).toContain("SET search_path = ''");
  });

  it('does not accept client user_id or hossii_key args', () => {
    expect(sqlBody).toMatch(
      /submit_challenge_comment_response\(\s*p_item_id uuid,\s*p_comment text,\s*p_visibility text/,
    );
    expect(sqlBody).not.toMatch(/p_user_id/);
    expect(sqlBody).not.toMatch(/p_hossii_key/);
  });

  it('re-links completion.response_id without rewriting completed_at', () => {
    expect(sqlBody).toContain('SET response_id = EXCLUDED.response_id');
    expect(sqlBody).not.toMatch(/SET[\s\S]*completed_at\s*=/);
  });

  it('keeps reward one-shot via ON CONFLICT DO NOTHING', () => {
    expect(sqlBody).toContain('ON CONFLICT (completion_id) DO NOTHING');
  });

  it('keeps authenticated-only EXECUTE', () => {
    expect(sqlBody).toContain(
      'GRANT EXECUTE ON FUNCTION public.submit_challenge_comment_response(uuid, text, text) TO authenticated',
    );
    expect(sqlBody).toContain(
      'REVOKE ALL ON FUNCTION public.submit_challenge_comment_response(uuid, text, text) FROM anon',
    );
  });
});
