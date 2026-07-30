import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  '../../../supabase/migrations/20260731030100_restrict_challenge_response_writes_to_rpc.sql',
);

describe('challenge_responses write restriction migration (static SQL)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const sqlBody = sql.replace(/--[^\n]*/g, '');

  it('drops participant INSERT and UPDATE policies', () => {
    expect(sqlBody).toContain(
      'DROP POLICY IF EXISTS "challenge_responses_insert_member_published_comment"',
    );
    expect(sqlBody).toContain(
      'DROP POLICY IF EXISTS "challenge_responses_update_owner_active"',
    );
  });

  it('revokes INSERT/UPDATE from authenticated and keeps SELECT/DELETE', () => {
    expect(sqlBody).toContain(
      'REVOKE INSERT, UPDATE ON public.challenge_responses FROM authenticated',
    );
    expect(sqlBody).toContain(
      'GRANT SELECT, DELETE ON public.challenge_responses TO authenticated',
    );
  });
});
