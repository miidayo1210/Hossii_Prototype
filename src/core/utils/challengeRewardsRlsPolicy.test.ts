import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHALLENGE_HOSSII_REWARD_KEYS } from '../assets/challengeHossiiKeys';

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  '../../../supabase/migrations/20260731030000_add_challenge_completions_and_rewards.sql',
);

describe('challenge completions/rewards migration (static SQL)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const sqlBody = sql.replace(/--[^\n]*/g, '');

  it('creates completions and rewards tables with uniqueness', () => {
    expect(sqlBody).toContain('CREATE TABLE public.challenge_completions');
    expect(sqlBody).toContain('CREATE TABLE public.challenge_rewards');
    expect(sqlBody).toContain('UNIQUE (item_id, user_id)');
    expect(sqlBody).toContain('UNIQUE (completion_id)');
  });

  it('keeps rewards after response delete via SET NULL', () => {
    expect(sqlBody).toMatch(
      /response_id[\s\S]*REFERENCES public\.challenge_responses\(id\) ON DELETE SET NULL/,
    );
  });

  it('enables own-only SELECT and no client write grants', () => {
    expect(sqlBody).toContain('challenge_completions_select_own');
    expect(sqlBody).toContain('challenge_rewards_select_own');
    expect(sqlBody).toMatch(/GRANT SELECT ON public\.challenge_completions TO authenticated/);
    expect(sqlBody).not.toMatch(
      /GRANT INSERT, UPDATE, DELETE ON public\.challenge_completions/,
    );
    expect(sqlBody).not.toMatch(
      /GRANT INSERT, UPDATE, DELETE ON public\.challenge_rewards/,
    );
  });

  it('defines SECURITY DEFINER submit RPC with fixed search_path', () => {
    expect(sqlBody).toContain('submit_challenge_comment_response');
    expect(sqlBody).toContain('SECURITY DEFINER');
    expect(sqlBody).toContain("SET search_path = ''");
    expect(sqlBody).toContain('auth.uid()');
    expect(sqlBody).toContain('is_active_space_member');
    expect(sqlBody).toContain("v_program.status IS DISTINCT FROM 'published'");
  });

  it('does not accept client hossii_key or user_id args', () => {
    expect(sqlBody).toMatch(
      /submit_challenge_comment_response\(\s*p_item_id uuid,\s*p_comment text,\s*p_visibility text/,
    );
    expect(sqlBody).not.toMatch(/p_user_id/);
    expect(sqlBody).not.toMatch(/p_hossii_key/);
  });

  it('grants RPC to authenticated only', () => {
    expect(sqlBody).toContain(
      'GRANT EXECUTE ON FUNCTION public.submit_challenge_comment_response(uuid, text, text) TO authenticated',
    );
    expect(sqlBody).toContain(
      'REVOKE ALL ON FUNCTION public.submit_challenge_comment_response(uuid, text, text) FROM anon',
    );
  });

  it('keeps TS Hossii key pool aligned with SQL pool', () => {
    for (const key of CHALLENGE_HOSSII_REWARD_KEYS) {
      expect(sqlBody).toContain(`'${key}'`);
    }
  });
});
