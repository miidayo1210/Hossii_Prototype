import { describe, expect, it } from 'vitest';
import { resolveMyHossiiImage } from './resolveMyHossiiImage';
import { HOSSII_IDLE } from '../assets/hossiiIdle';

describe('resolveMyHossiiImage', () => {
  it('resolves preset image path', () => {
    const src = resolveMyHossiiImage({
      hossiiSourceType: 'preset',
      hossiiPresetKey: 'idle_smile',
      hossiiImagePath: null,
    });
    expect(src).toBe('/hossii/idle/idle_smile.png');
  });

  it('falls back to default for unknown preset', () => {
    const src = resolveMyHossiiImage({
      hossiiSourceType: 'preset',
      hossiiPresetKey: 'unknown',
      hossiiImagePath: null,
    });
    expect(src).toBe(HOSSII_IDLE.base);
  });

  it('uses upload path when source is upload', () => {
    const src = resolveMyHossiiImage({
      hossiiSourceType: 'upload',
      hossiiPresetKey: null,
      hossiiImagePath: 'avatars/user-1/my-hossii.webp',
    });
    expect(src).toContain('avatars/user-1/my-hossii.webp');
  });
});
