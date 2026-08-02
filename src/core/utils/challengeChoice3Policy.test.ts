import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_CHOICE3_OPTION_COUNT,
  buildChoice3ResponseConfig,
  findChallengeChoice3OptionIndex,
  normalizeChallengeChoice3Options,
  parseChallengeChoice3Options,
} from './challengeChoice3';

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  '../../../supabase/migrations/20260803020000_challenge_choice3.sql',
);

describe('challenge choice3 migration (static SQL)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const sqlBody = sql.replace(/--[^\n]*/g, '');

  it('adds choice3 RPC with upsert rewrite and visibility freeze', () => {
    expect(sqlBody).toContain(
      'CREATE OR REPLACE FUNCTION public.submit_challenge_choice3',
    );
    expect(sqlBody).toContain('p_option_index integer');
    expect(sqlBody).toContain("response_type IS DISTINCT FROM 'choice3'");
    expect(sqlBody).toContain("response_config -> 'options'");
    expect(sqlBody).toContain('exactly 3');
    expect(sqlBody).toContain('ON CONFLICT (item_id, user_id) DO UPDATE');
    expect(sqlBody).toContain('SET comment = EXCLUDED.comment');
    expect(sqlBody).toContain(
      'GRANT EXECUTE ON FUNCTION public.submit_challenge_choice3(uuid, integer) TO authenticated',
    );
  });

  it('does not rewrite visibility on conflict update', () => {
    expect(sqlBody).not.toMatch(
      /ON CONFLICT \(item_id, user_id\) DO UPDATE[\s\S]*SET[\s\S]*visibility\s*=/,
    );
  });
});

describe('challengeChoice3 helpers', () => {
  it('requires exactly 3 non-empty trimmed options', () => {
    expect(normalizeChallengeChoice3Options(['a', 'b', 'c']).ok).toBe(true);
    expect(normalizeChallengeChoice3Options([' a ', 'b', 'c']).ok).toBe(true);
    expect(normalizeChallengeChoice3Options(['a', 'b']).ok).toBe(false);
    expect(normalizeChallengeChoice3Options(['a', 'b', '']).ok).toBe(false);
    expect(normalizeChallengeChoice3Options(['a', 'b', 'c', 'd']).ok).toBe(
      false,
    );
    expect(CHALLENGE_CHOICE3_OPTION_COUNT).toBe(3);
  });

  it('builds and parses response_config.options', () => {
    const config = buildChoice3ResponseConfig(['はい', 'どちらでも', 'いいえ']);
    expect(config).toEqual({
      options: ['はい', 'どちらでも', 'いいえ'],
    });
    expect(parseChallengeChoice3Options(config)).toEqual([
      'はい',
      'どちらでも',
      'いいえ',
    ]);
    expect(parseChallengeChoice3Options({ options: ['x'] })).toBeNull();
  });

  it('finds selected option index by snapshot label', () => {
    const options = ['A', 'B', 'C'] as const;
    expect(findChallengeChoice3OptionIndex(options, 'B')).toBe(1);
    expect(findChallengeChoice3OptionIndex(options, 'Z')).toBe(-1);
  });
});
