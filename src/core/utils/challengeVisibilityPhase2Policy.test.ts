import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  '../../../supabase/migrations/20260801010000_challenge_response_visibility_phase2.sql',
);

/**
 * Phase 2 visibility foundation — static SQL assertions.
 * Live RLS / RPC behavior is verified on Development after db:push:dev.
 */
describe('challenge response visibility Phase 2 migration (static SQL)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const sqlBody = sql.replace(/--[^\n]*/g, '');

  it('adds program default_response_visibility NOT NULL DEFAULT manager_only', () => {
    expect(sqlBody).toMatch(
      /challenge_programs[\s\S]*default_response_visibility text NOT NULL DEFAULT 'manager_only'/,
    );
    expect(sqlBody).toContain('challenge_programs_default_response_visibility_check');
    expect(sqlBody).toMatch(
      /default_response_visibility IN \(\s*'space_members',\s*'manager_only',\s*'self_only'\s*\)/,
    );
  });

  it('adds nullable item response_visibility override', () => {
    expect(sqlBody).toMatch(
      /challenge_items[\s\S]*ADD COLUMN IF NOT EXISTS response_visibility text/,
    );
    expect(sqlBody).toContain('challenge_items_response_visibility_check');
    expect(sqlBody).toMatch(
      /response_visibility IS NULL\s+OR response_visibility IN/,
    );
  });

  it('expands challenge_responses.visibility CHECK with space_members', () => {
    expect(sqlBody).toContain('DROP CONSTRAINT IF EXISTS challenge_responses_visibility_check');
    expect(sqlBody).toMatch(
      /visibility IN \(\s*'self_only',\s*'manager_only',\s*'space_members'\s*\)/,
    );
  });

  it('does not UPDATE existing challenge_responses rows', () => {
    expect(sqlBody).not.toMatch(
      /UPDATE\s+public\.challenge_responses\s+SET[\s\S]*visibility/i,
    );
    expect(sqlBody).not.toMatch(
      /UPDATE\s+challenge_responses\s+SET[\s\S]*visibility/i,
    );
  });

  it('replaces SELECT policy and covers all three visibilities', () => {
    expect(sqlBody).toContain('DROP POLICY IF EXISTS "challenge_responses_select_owner_or_manager"');
    expect(sqlBody).toContain('challenge_responses_select_by_visibility');
    expect(sqlBody).toContain("visibility = 'manager_only'");
    expect(sqlBody).toContain("visibility = 'space_members'");
    expect(sqlBody).toContain('user_id = auth.uid()');
    expect(sqlBody).toContain('is_space_community_admin');
    expect(sqlBody).toContain('is_active_space_member');
  });

  it('reuses existing membership/admin helpers (does not create new ones)', () => {
    expect(sqlBody).not.toMatch(/CREATE\s+(OR REPLACE\s+)?FUNCTION\s+public\.is_active_space_member/i);
    expect(sqlBody).not.toMatch(
      /CREATE\s+(OR REPLACE\s+)?FUNCTION\s+public\.is_space_community_admin/i,
    );
  });

  it('keeps self_only out of manager and space_members branches', () => {
    expect(sqlBody).not.toMatch(
      /visibility = 'self_only'[\s\S]*is_space_community_admin/,
    );
    expect(sqlBody).not.toMatch(
      /visibility = 'self_only'[\s\S]*is_active_space_member/,
    );
  });

  it('resolves INSERT visibility from item override then program default', () => {
    expect(sqlBody).toContain('CREATE OR REPLACE FUNCTION public.submit_challenge_comment_response');
    expect(sqlBody).toMatch(
      /v_visibility\s*:=\s*COALESCE\(\s*v_item\.response_visibility,\s*v_program\.default_response_visibility/,
    );
  });

  it('ignores client p_visibility and freezes visibility on UPDATE', () => {
    expect(sql).toMatch(/p_visibility is accepted[\s\S]*ignored/i);
    expect(sqlBody).toMatch(/p_visibility text DEFAULT 'manager_only'/);
    expect(sqlBody).toContain('ON CONFLICT (item_id, user_id) DO UPDATE');
    expect(sqlBody).toContain('SET comment = EXCLUDED.comment');
    expect(sqlBody).not.toContain('visibility = EXCLUDED.visibility');
  });

  it('keeps write path as SECURITY DEFINER RPC with authenticated EXECUTE only', () => {
    expect(sqlBody).toContain('SECURITY DEFINER');
    expect(sqlBody).toContain("SET search_path = ''");
    expect(sqlBody).toContain(
      'GRANT EXECUTE ON FUNCTION public.submit_challenge_comment_response(uuid, text, text) TO authenticated',
    );
    expect(sqlBody).toContain(
      'REVOKE ALL ON FUNCTION public.submit_challenge_comment_response(uuid, text, text) FROM anon',
    );
  });
});
