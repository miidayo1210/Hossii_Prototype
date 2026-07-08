import { describe, expect, it } from 'vitest';
import {
  buildAddHossiiBlockMessage,
  isKnownSpaceInState,
} from './addHossiiGuard';

describe('addHossiiGuard', () => {
  it('detects unknown space ids', () => {
    expect(isKnownSpaceInState('dev-space-public', ['dev-space-public'])).toBe(true);
    expect(isKnownSpaceInState('default-space', ['dev-space-public'])).toBe(false);
  });

  it('returns user-facing messages for blocked posts', () => {
    expect(buildAddHossiiBlockMessage('space_unavailable')).toContain('Development環境');
    expect(buildAddHossiiBlockMessage('pane_unavailable')).toContain('タブ');
  });
});
