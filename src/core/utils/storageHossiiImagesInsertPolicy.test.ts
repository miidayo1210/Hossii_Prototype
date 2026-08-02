import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  '../../../supabase/migrations/20260803040000_fix_hossii_images_insert_bucket_scope.sql',
);

describe('storage hossii-images insert bucket-scope hotfix', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const sqlBody = sql.replace(/--[^\n]*/g, '');

  it('replaces hossii-images insert with bucket-scoped WITH CHECK', () => {
    expect(sqlBody).toContain('DROP POLICY IF EXISTS "hossii-images insert"');
    expect(sqlBody).toContain('CREATE POLICY "hossii-images insert"');
    expect(sqlBody).toMatch(
      /WITH CHECK\s*\(\s*bucket_id\s*=\s*'hossii-images'\s*\)/,
    );
    expect(sqlBody).not.toMatch(/WITH CHECK\s*\(\s*true\s*\)/);
  });
});
