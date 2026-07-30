import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  '../../../supabase/migrations/20260731010000_add_challenge_programs_and_items.sql',
);

/**
 * Stage 1 challenge DB foundation — static SQL assertions.
 * Live RLS is verified separately against Development DB.
 */
describe('challenge_programs / challenge_items migration (static SQL)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const sqlBody = sql.replace(/--[^\n]*/g, '');

  it('creates both tables', () => {
    expect(sqlBody).toContain('CREATE TABLE public.challenge_programs');
    expect(sqlBody).toContain('CREATE TABLE public.challenge_items');
  });

  it('enables RLS on both tables', () => {
    expect(sqlBody).toMatch(
      /ALTER TABLE public\.challenge_programs\s+ENABLE ROW LEVEL SECURITY/,
    );
    expect(sqlBody).toMatch(
      /ALTER TABLE public\.challenge_items\s+ENABLE ROW LEVEL SECURITY/,
    );
  });

  it('reuses is_space_community_admin for program and item policies', () => {
    expect(sqlBody).toContain('public.is_space_community_admin(space_id)');
    expect(sqlBody).toContain('public.is_space_community_admin(p.space_id)');
  });

  it('does not create participant or anon-facing policies', () => {
    expect(sqlBody).not.toMatch(/TO anon/i);
    expect(sqlBody).not.toMatch(/participant/i);
    expect(sqlBody).not.toContain('can_access_space');
    expect(sqlBody).not.toContain('is_active_space_member');
  });

  it('restricts program DELETE to draft status', () => {
    expect(sqlBody).toContain('challenge_programs_delete_admin_draft');
    expect(sqlBody).toMatch(/FOR DELETE[\s\S]*status = 'draft'/);
  });

  it('does not add space_id on challenge_items', () => {
    const itemsBlock = sqlBody.slice(
      sqlBody.indexOf('CREATE TABLE public.challenge_items'),
      sqlBody.indexOf('CREATE INDEX challenge_items_program_sort_idx'),
    );
    expect(itemsBlock).not.toMatch(/\bspace_id\b/);
  });

  it('defines the four response_type values', () => {
    expect(sqlBody).toContain("'comment'");
    expect(sqlBody).toContain("'photo'");
    expect(sqlBody).toContain("'single_choice'");
    expect(sqlBody).toContain("'completion'");
    expect(sqlBody).not.toContain("'choice3'");
    expect(sqlBody).not.toContain("'complete_button'");
  });

  it('cascades item FK delete with programs', () => {
    expect(sqlBody).toMatch(
      /REFERENCES public\.challenge_programs\(id\) ON DELETE CASCADE/,
    );
    expect(sqlBody).toMatch(
      /REFERENCES public\.spaces\(id\) ON DELETE CASCADE/,
    );
  });

  it('prevents created_by spoofing via trigger and INSERT WITH CHECK', () => {
    expect(sqlBody).toContain('challenge_programs_guard_created_by');
    expect(sqlBody).toContain('NEW.created_by := auth.uid()');
    expect(sqlBody).toContain('created_by = auth.uid()');
  });

  it('restricts item DELETE and INSERT to draft parent programs', () => {
    expect(sqlBody).toContain('challenge_items_delete_admin_draft');
    expect(sqlBody).toContain('challenge_items_insert_admin_draft');
    expect(sqlBody).toMatch(
      /challenge_items_delete_admin_draft[\s\S]*p\.status = 'draft'/,
    );
  });

  it('uses draft-limited item UPDATE for Stage 1 (case A)', () => {
    expect(sqlBody).toContain('challenge_items_update_admin_draft');
    expect(sqlBody).toMatch(
      /challenge_items_update_admin_draft[\s\S]*p\.status = 'draft'[\s\S]*WITH CHECK/,
    );
  });

  it('creates required indexes and does not unique sort_order', () => {
    expect(sqlBody).toContain('challenge_programs_space_id_idx');
    expect(sqlBody).toContain('challenge_programs_space_status_idx');
    expect(sqlBody).toContain('challenge_items_program_sort_idx');
    expect(sqlBody).not.toMatch(
      /UNIQUE\s*\(\s*program_id\s*,\s*sort_order\s*\)/,
    );
    expect(sqlBody).not.toContain('created_by_idx');
  });

  it('grants CRUD only to authenticated', () => {
    expect(sqlBody).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_programs TO authenticated',
    );
    expect(sqlBody).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_items TO authenticated',
    );
    expect(sqlBody).not.toMatch(
      /GRANT .+ ON public\.challenge_programs TO anon/,
    );
  });
});
