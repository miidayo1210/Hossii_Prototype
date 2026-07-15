import { describe, expect, it } from 'vitest';
import { isActiveSpaceShellUnavailable } from './spaceShellAvailability';

describe('isActiveSpaceShellUnavailable', () => {
  it('is true when activeSpaceId exists but space is missing after load', () => {
    expect(
      isActiveSpaceShellUnavailable({
        isSupabaseConfigured: true,
        spacesLoadedFromSupabase: true,
        activeSpaceId: 'stale-id',
        hasActiveSpace: false,
      }),
    ).toBe(true);
  });

  it('is false while spaces are still loading', () => {
    expect(
      isActiveSpaceShellUnavailable({
        isSupabaseConfigured: true,
        spacesLoadedFromSupabase: false,
        activeSpaceId: 'stale-id',
        hasActiveSpace: false,
      }),
    ).toBe(false);
  });

  it('is false when active space is resolved', () => {
    expect(
      isActiveSpaceShellUnavailable({
        isSupabaseConfigured: true,
        spacesLoadedFromSupabase: true,
        activeSpaceId: 'space-1',
        hasActiveSpace: true,
      }),
    ).toBe(false);
  });
});
