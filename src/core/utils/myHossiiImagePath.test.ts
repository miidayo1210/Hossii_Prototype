import { describe, expect, it } from 'vitest';
import { isValidMyHossiiImagePathForUser } from './myHossiiImagePath';

const USER_ID = '11111111-1111-1111-1111-111111111111';

describe('isValidMyHossiiImagePathForUser', () => {
  it('accepts own avatar path', () => {
    expect(
      isValidMyHossiiImagePathForUser(`avatars/${USER_ID}/my-hossii.webp`, USER_ID),
    ).toBe(true);
  });

  it('rejects another user path', () => {
    expect(
      isValidMyHossiiImagePathForUser(
        'avatars/22222222-2222-2222-2222-222222222222/my-hossii.webp',
        USER_ID,
      ),
    ).toBe(false);
  });

  it('rejects arbitrary URLs', () => {
    expect(isValidMyHossiiImagePathForUser('https://evil.example/a.png', USER_ID)).toBe(false);
  });
});
