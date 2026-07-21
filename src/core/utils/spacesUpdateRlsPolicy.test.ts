import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  '../../../supabase/migrations/20260721120000_fix_spaces_update_policy_for_multi_admin.sql',
);

const PARTICIPATION_MODE_MIGRATION = resolve(
  import.meta.dirname,
  '../../../supabase/migrations/20260721100000_add_space_participation_mode.sql',
);

/**
 * EXISTS policy の期待マトリクス（PostgreSQL RLS そのものの証明ではない）。
 * 「対象 space.community_id が、admin が管理する community 一覧に含まれるか」の記録用。
 */
function canAdminUpdateSpace(
  administeredCommunityIds: readonly string[],
  spaceCommunityId: string | null | undefined,
): boolean {
  return spaceCommunityId != null && administeredCommunityIds.includes(spaceCommunityId);
}

describe('spaces_update_own migration (static SQL)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const sqlBody = sql.replace(/--[^\n]*/g, '');
  const participationModeSql = readFileSync(PARTICIPATION_MODE_MIGRATION, 'utf8');

  it('drops and recreates spaces_update_own for UPDATE with USING and WITH CHECK', () => {
    expect(sql).toContain('DROP POLICY IF EXISTS "spaces_update_own"');
    expect(sqlBody).toContain('CREATE POLICY "spaces_update_own"');
    expect(sqlBody).toContain('ON public.spaces');
    expect(sqlBody).toContain('FOR UPDATE');
    expect(sqlBody).toMatch(/USING\s*\(/);
    expect(sqlBody).toMatch(/WITH CHECK\s*\(/);
  });

  it('uses correlated EXISTS on spaces.community_id and communities.admin_id', () => {
    expect(sqlBody).toMatch(/EXISTS\s*\(/);
    expect(sqlBody).toContain('FROM public.communities c');
    expect(sqlBody).toContain('c.id = spaces.community_id');
    expect(sqlBody).toContain('c.admin_id = auth.uid()');
    expect(sqlBody).not.toMatch(
      /community_id\s*=\s*\(\s*SELECT id FROM (?:public\.)?communities WHERE admin_id = auth\.uid\(\)\s*\)/,
    );
  });

  it('does not alter super_admin, INSERT, DELETE, or participation_mode migrations', () => {
    expect(sqlBody).toContain('DROP POLICY IF EXISTS "spaces_update_own"');
    expect(sqlBody).not.toMatch(/DROP POLICY IF EXISTS "(?!spaces_update_own)/);
    expect(sqlBody).not.toContain('spaces_update_super_admin');
    expect(sqlBody).not.toContain('spaces_insert_own');
    expect(sqlBody).not.toContain('spaces_delete_own');
    expect(sqlBody).not.toContain('spaces_select');
    expect(participationModeSql).toContain('participation_mode');
    expect(sqlBody).not.toContain('ADD COLUMN');
    expect(sqlBody).not.toContain('participation_mode');
  });
});

describe('spaces_update_own EXISTS design (expected matrix, not live RLS proof)', () => {
  const comm1 = '11111111-1111-1111-1111-111111111111';
  const comm2 = '22222222-2222-2222-2222-222222222222';
  const comm3 = '33333333-3333-3333-3333-333333333333';
  const multiAdmin = [comm1, comm2] as const;

  it('multi-community admin: spaces in administered communities → allowed', () => {
    expect(canAdminUpdateSpace(multiAdmin, comm1)).toBe(true);
    expect(canAdminUpdateSpace(multiAdmin, comm2)).toBe(true);
  });

  it('multi-community admin: space in other community → denied', () => {
    expect(canAdminUpdateSpace(multiAdmin, comm3)).toBe(false);
  });

  it('single-community admin: own community allowed, other denied', () => {
    expect(canAdminUpdateSpace([comm1], comm1)).toBe(true);
    expect(canAdminUpdateSpace([comm1], comm2)).toBe(false);
  });

  it('regular user / participant (no administered communities) → denied', () => {
    expect(canAdminUpdateSpace([], comm1)).toBe(false);
  });

  it('null community_id → denied', () => {
    expect(canAdminUpdateSpace([comm1], null)).toBe(false);
    expect(canAdminUpdateSpace([comm1], undefined)).toBe(false);
  });

  it('WITH CHECK: post-update community_id outside administered set → denied', () => {
    expect(canAdminUpdateSpace(multiAdmin, comm3)).toBe(false);
  });

  it('row-level policy is field-agnostic (participation_mode, is_private, description)', () => {
    expect(canAdminUpdateSpace(multiAdmin, comm1)).toBe(true);
  });
});
