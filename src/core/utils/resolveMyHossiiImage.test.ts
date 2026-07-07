import { describe, expect, it } from 'vitest';
import { resolveMyHossiiImage } from './resolveMyHossiiImage';
import { HOSSII_IDLE } from '../assets/hossiiIdle';

describe('resolveMyHossiiImage', () => {
  it('resolves preset image path', () => {
    const src = resolveMyHossiiImage({
      userId: 'user-1',
      hossiiSourceType: 'preset',
      hossiiPresetKey: 'idle_smile',
      hossiiImagePath: null,
    });
    expect(src).toBe('/hossii/idle/idle_smile.png');
  });

  it('falls back to default for unknown preset', () => {
    const src = resolveMyHossiiImage({
      userId: 'user-1',
      hossiiSourceType: 'preset',
      hossiiPresetKey: 'unknown',
      hossiiImagePath: null,
    });
    expect(src).toBe(HOSSII_IDLE.base);
  });

  it('uses upload path when source is upload and path belongs to user', () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const src = resolveMyHossiiImage({
      userId,
      hossiiSourceType: 'upload',
      hossiiPresetKey: null,
      hossiiImagePath: `avatars/${userId}/my-hossii.webp`,
    });
    expect(src).toContain(`avatars/${userId}/my-hossii.webp`);
  });

  it('rejects upload path that does not belong to user', () => {
    const src = resolveMyHossiiImage({
      userId: '11111111-1111-1111-1111-111111111111',
      hossiiSourceType: 'upload',
      hossiiPresetKey: null,
      hossiiImagePath: 'avatars/other-user/my-hossii.webp',
    });
    expect(src).toBe(HOSSII_IDLE.base);
  });
});
