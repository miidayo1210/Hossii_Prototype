import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  '../../../supabase/migrations/20260731020100_restrict_challenge_member_select_to_published.sql',
);

describe('challenge member SELECT published-only migration (static SQL)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const sqlBody = sql.replace(/--[^\n]*/g, '');

  it('recreates member policies as published-only', () => {
    expect(sqlBody).toContain('DROP POLICY IF EXISTS "challenge_programs_select_member_visible"');
    expect(sqlBody).toContain('DROP POLICY IF EXISTS "challenge_items_select_member_visible"');
    expect(sqlBody).toMatch(/status = 'published'/);
    expect(sqlBody).not.toMatch(/status IN \('published', 'ended', 'archived'\)/);
  });

  it('keeps active membership requirement', () => {
    expect(sqlBody).toContain('is_active_space_member');
  });
});
