import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  '../../../supabase/migrations/20260731020000_add_challenge_responses.sql',
);

/**
 * P4 challenge_responses — static SQL assertions.
 * Live RLS is verified separately against Development DB.
 */
describe('challenge_responses migration (static SQL)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const sqlBody = sql.replace(/--[^\n]*/g, '');

  it('creates challenge_responses table', () => {
    expect(sqlBody).toContain('CREATE TABLE public.challenge_responses');
  });

  it('enables RLS', () => {
    expect(sqlBody).toMatch(
      /ALTER TABLE public\.challenge_responses\s+ENABLE ROW LEVEL SECURITY/,
    );
  });

  it('enforces unique (item_id, user_id)', () => {
    expect(sqlBody).toContain('UNIQUE (item_id, user_id)');
  });

  it('checks visibility values', () => {
    expect(sqlBody).toContain("'self_only'");
    expect(sqlBody).toContain("'manager_only'");
    expect(sqlBody).toMatch(/visibility IN \('self_only', 'manager_only'\)/);
  });

  it('checks comment length 1..500 after trim', () => {
    expect(sqlBody).toMatch(
      /char_length\(btrim\(comment\)\) BETWEEN 1 AND 500/,
    );
  });

  it('forces user_id via trigger and defaults', () => {
    expect(sqlBody).toContain('challenge_responses_guard_user_id');
    expect(sqlBody).toContain('NEW.user_id := auth.uid()');
    expect(sqlBody).toContain('DEFAULT auth.uid()');
  });

  it('prevents item_id and user_id rewrite on update', () => {
    expect(sqlBody).toContain('NEW.item_id := OLD.item_id');
    expect(sqlBody).toContain('NEW.user_id := OLD.user_id');
  });

  it('uses RESTRICT on item and user FKs', () => {
    expect(sqlBody).toMatch(
      /REFERENCES public\.challenge_items\(id\) ON DELETE RESTRICT/,
    );
    expect(sqlBody).toMatch(
      /REFERENCES auth\.users\(id\) ON DELETE RESTRICT/,
    );
  });

  it('adds participant SELECT for published programs/items', () => {
    expect(sqlBody).toContain('challenge_programs_select_member_visible');
    expect(sqlBody).toContain('challenge_items_select_member_visible');
    expect(sqlBody).toContain('is_active_space_member');
  });

  it('scopes insert to published comment items and active members', () => {
    expect(sqlBody).toContain('challenge_responses_insert_member_published_comment');
    expect(sqlBody).toContain("i.response_type = 'comment'");
    expect(sqlBody).toContain("p.status = 'published'");
  });

  it('allows owner update on published/ended only', () => {
    expect(sqlBody).toContain('challenge_responses_update_owner_active');
    expect(sqlBody).toContain("p.status IN ('published', 'ended')");
  });

  it('allows owner delete only', () => {
    expect(sqlBody).toContain('challenge_responses_delete_owner');
    expect(sqlBody).toMatch(
      /challenge_responses_delete_owner[\s\S]*USING \(user_id = auth\.uid\(\)\)/,
    );
  });

  it('keeps self_only out of manager branch', () => {
    expect(sqlBody).toContain("visibility = 'manager_only'");
    expect(sqlBody).not.toMatch(
      /visibility = 'self_only'[\s\S]*is_space_community_admin/,
    );
  });

  it('does not grant to anon', () => {
    expect(sqlBody).not.toMatch(/TO anon/i);
    expect(sqlBody).not.toMatch(
      /GRANT[\s\S]*challenge_responses[\s\S]*TO anon/i,
    );
  });
});
