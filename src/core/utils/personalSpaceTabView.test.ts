import { describe, expect, it } from 'vitest';
import {
  applyPostTargetToInput,
  resolveContentSpaceId,
  resolvePersonalPostTarget,
} from './personalSpaceTabView';

describe('resolveContentSpaceId', () => {
  it('uses personal view id only on shared shell', () => {
    expect(
      resolveContentSpaceId({
        shellSpaceType: 'shared',
        shellSpaceId: 'shared-1',
        personalViewSpaceId: 'personal-1',
      }),
    ).toBe('personal-1');
  });

  it('keeps shell id when not in personal tab view', () => {
    expect(
      resolveContentSpaceId({
        shellSpaceType: 'shared',
        shellSpaceId: 'shared-1',
        personalViewSpaceId: null,
      }),
    ).toBe('shared-1');
  });

  it('ignores personal view when shell is already personal URL', () => {
    expect(
      resolveContentSpaceId({
        shellSpaceType: 'personal',
        shellSpaceId: 'personal-1',
        personalViewSpaceId: 'personal-2',
      }),
    ).toBe('personal-1');
  });

  it('uses personal view id on legacy shell without spaceType', () => {
    expect(
      resolveContentSpaceId({
        shellSpaceType: undefined,
        shellSpaceId: 'shared-1',
        personalViewSpaceId: 'personal-1',
      }),
    ).toBe('personal-1');
  });
});

describe('resolvePersonalPostTarget', () => {
  it('returns personal space default pane target', () => {
    expect(
      resolvePersonalPostTarget('ps-1', (id) => `pane:${id}`),
    ).toEqual({ spaceId: 'ps-1', paneId: 'pane:ps-1' });
  });

  it('returns null when personal tab is inactive', () => {
    expect(resolvePersonalPostTarget(null, (id) => id)).toBeNull();
  });
});

describe('applyPostTargetToInput', () => {
  it('injects post override fields', () => {
    expect(
      applyPostTargetToInput({ message: 'hi' }, { spaceId: 'ps-1', paneId: 'pane-1' }),
    ).toEqual({
      message: 'hi',
      postSpaceId: 'ps-1',
      postPaneId: 'pane-1',
    });
  });
});
