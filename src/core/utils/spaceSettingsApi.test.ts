import { describe, expect, it } from 'vitest';
import { parseSpaceSettingsRow } from './spaceSettingsApi';
import { resolvePostFields } from './postFieldSettings';

describe('parseSpaceSettingsRow', () => {
  it('reads feature_message_post when present', () => {
    const settings = parseSpaceSettingsRow(
      {
        space_id: 's1',
        feature_message_post: false,
        feature_likes_enabled: true,
        bottle_frequency: '3d-7d',
      },
      'Test',
    );
    expect(settings.features.messagePost).toBe(false);
  });

  it('falls back to feature_comment_post for legacy rows', () => {
    const settings = parseSpaceSettingsRow(
      {
        space_id: 's1',
        feature_comment_post: false,
        feature_likes_enabled: true,
        bottle_frequency: '3d-7d',
      },
      'Test',
    );
    expect(settings.features.messagePost).toBe(false);
  });

  it('resolves message.enabled from legacy features when post_fields absent', () => {
    const settings = parseSpaceSettingsRow(
      {
        space_id: 's1',
        feature_comment_post: false,
        feature_emotion_post: true,
        feature_photo_post: true,
        feature_number_post: false,
        feature_likes_enabled: true,
        bottle_frequency: '3d-7d',
      },
      'Test',
    );
    const pf = resolvePostFields(settings);
    expect(pf.message.enabled).toBe(false);
    expect(pf.emotion.enabled).toBe(true);
  });
});
