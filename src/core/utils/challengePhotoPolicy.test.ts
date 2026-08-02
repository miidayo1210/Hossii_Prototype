import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_PHOTO_BUCKET,
  CHALLENGE_PHOTO_COMMENT,
  buildChallengePhotoStoragePath,
  isValidChallengePhotoStoragePath,
} from './challengePhoto';

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  '../../../supabase/migrations/20260803030000_challenge_photo_foundation.sql',
);

describe('challenge photo foundation migration (static SQL)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const sqlBody = sql.replace(/--[^\n]*/g, '');

  it('creates private challenge-photos bucket', () => {
    expect(sqlBody).toContain("'challenge-photos'");
    expect(sqlBody).toMatch(/public\s*=\s*false|false,\s*\n\s*5242880/);
    expect(sqlBody).toContain('INSERT INTO storage.buckets');
  });

  it('adds photo_path and photo RPC with visibility freeze', () => {
    expect(sqlBody).toContain('ADD COLUMN IF NOT EXISTS photo_path text NULL');
    expect(sqlBody).toContain(
      'CREATE OR REPLACE FUNCTION public.submit_challenge_photo',
    );
    expect(sqlBody).toContain("v_comment text := '写真'");
    expect(sqlBody).toContain("response_type IS DISTINCT FROM 'photo'");
    expect(sqlBody).toContain('ON CONFLICT (item_id, user_id) DO UPDATE');
    expect(sqlBody).toContain('photo_path = EXCLUDED.photo_path');
    expect(sqlBody).not.toMatch(
      /ON CONFLICT \(item_id, user_id\) DO UPDATE[\s\S]*SET[\s\S]*visibility\s*=/,
    );
    expect(sqlBody).toContain(
      'GRANT EXECUTE ON FUNCTION public.submit_challenge_photo(uuid, text) TO authenticated',
    );
  });

  it('defines Storage RLS helpers matching response visibility', () => {
    expect(sqlBody).toContain('can_select_challenge_photo_object');
    // self_only → owner only (r.user_id = auth.uid); no peer SELECT branch
    expect(sqlBody).toContain('r.user_id = auth.uid()');
    expect(sqlBody).toContain("r.visibility = 'manager_only'");
    expect(sqlBody).toContain("r.visibility = 'space_members'");
    expect(sqlBody).toContain('is_space_community_admin');
    expect(sqlBody).toContain('is_active_space_member');
    expect(sqlBody).toContain('challenge_photos_select');
    expect(sqlBody).toContain('challenge_photos_insert_owner');
    expect(sqlBody).toContain('challenge_photos_delete_owner');
    expect(sqlBody).toContain("(storage.foldername(name))[4] = auth.uid()::text");
  });
});

describe('challengePhoto path helpers', () => {
  const spaceId = 'dev-space-public';
  const itemId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const objectId = '33333333-3333-4333-8333-333333333333';

  it('builds and validates canonical paths', () => {
    const path = buildChallengePhotoStoragePath({
      spaceId,
      itemId,
      userId,
      objectId,
    });
    expect(path).toBe(
      `challenge/${spaceId}/${itemId}/${userId}/${objectId}.jpg`,
    );
    expect(
      isValidChallengePhotoStoragePath(path, { spaceId, itemId, userId }),
    ).toBe(true);
    expect(CHALLENGE_PHOTO_BUCKET).toBe('challenge-photos');
    expect(CHALLENGE_PHOTO_COMMENT).toBe('写真');
  });

  it('rejects traversal and wrong owners', () => {
    expect(
      isValidChallengePhotoStoragePath(
        `challenge/${spaceId}/${itemId}/${userId}/../${objectId}.jpg`,
      ),
    ).toBe(false);
    expect(
      isValidChallengePhotoStoragePath(
        `challenge/${spaceId}/${itemId}/${userId}/${objectId}.jpg`,
        {
          spaceId,
          itemId,
          userId: '44444444-4444-4444-8444-444444444444',
        },
      ),
    ).toBe(false);
  });
});
