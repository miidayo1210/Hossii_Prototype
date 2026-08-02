import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_COMPLETE_BUTTON_COMMENT,
  CHALLENGE_PARTICIPANT_RESPONSE_TYPES,
} from './challengeCompleteButton';

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  '../../../supabase/migrations/20260803010000_challenge_complete_button.sql',
);

describe('challenge complete_button migration (static SQL)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const sqlBody = sql.replace(/--[^\n]*/g, '');

  it('renames response_type CHECK to product names', () => {
    expect(sqlBody).toContain("'complete_button'");
    expect(sqlBody).toContain("'choice3'");
    expect(sqlBody).toContain("'comment'");
    expect(sqlBody).toContain("'photo'");
    expect(sqlBody).toMatch(
      /CHECK\s*\(\s*response_type\s+IN\s*\(\s*'comment',\s*'complete_button',\s*'choice3',\s*'photo'\s*\)\s*\)/,
    );
  });

  it('refuses rename when legacy completion/single_choice rows exist', () => {
    expect(sqlBody).toContain("'completion'");
    expect(sqlBody).toContain("'single_choice'");
    expect(sqlBody).toContain('cannot rename response_type CHECK');
  });

  it('adds response_config jsonb and complete_button RPC', () => {
    expect(sqlBody).toContain('ADD COLUMN IF NOT EXISTS response_config jsonb NULL');
    expect(sqlBody).toContain(
      'CREATE OR REPLACE FUNCTION public.submit_challenge_complete_button',
    );
    expect(sqlBody).toContain(CHALLENGE_COMPLETE_BUTTON_COMMENT);
    expect(sqlBody).toContain('ON CONFLICT (item_id, user_id) DO NOTHING');
    expect(sqlBody).toContain(
      "GRANT EXECUTE ON FUNCTION public.submit_challenge_complete_button(uuid) TO authenticated",
    );
  });
});

describe('challengeCompleteButton helpers', () => {
  it('exposes participant-supported types', () => {
    expect(CHALLENGE_PARTICIPANT_RESPONSE_TYPES).toEqual([
      'comment',
      'complete_button',
    ]);
  });
});
