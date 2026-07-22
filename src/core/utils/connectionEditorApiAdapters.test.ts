import { describe, it, expect } from 'vitest';
import {
  formatConnectionApiError,
  mapCreateConnectionResult,
} from './connectionEditorApiAdapters';

describe('connectionEditorApiAdapters', () => {
  it('maps duplicate DB errors to user-facing copy', () => {
    expect(
      formatConnectionApiError({
        ok: false,
        message: 'duplicate key value violates unique constraint',
        code: '23505',
      }),
    ).toBe('この2つの Hossii はすでにつながっています');
  });

  it('maps successful create results to editor mutation shape', () => {
    const connection = {
      id: 'conn-1',
      spaceId: 'space-1',
      paneId: 'pane-1',
      sourceHossiiId: 'a',
      targetHossiiId: 'b',
      strength: 'medium' as const,
      createdBy: null,
      createdAt: '2026-07-22T00:00:00.000Z',
      updatedAt: '2026-07-22T00:00:00.000Z',
    };

    expect(mapCreateConnectionResult({ ok: true, connection })).toEqual({
      ok: true,
      data: connection,
    });
  });
});
