import { describe, expect, it, vi } from 'vitest';
import {
  formatInsertHossiiErrorMessage,
  formatPostFailureForDisplay,
  mapInsertFailureReason,
} from './postFeedback';

describe('postFeedback', () => {
  it('maps pane mismatch errors to development guidance', () => {
    expect(formatInsertHossiiErrorMessage('space_pane_id does not belong to space_id')).toContain(
      'Development環境',
    );
  });

  it('maps foreign key errors to missing space guidance', () => {
    expect(formatInsertHossiiErrorMessage('violates foreign key constraint on space_id')).toContain(
      'Development環境に存在しません',
    );
  });

  it('maps missing column errors to schema guidance', () => {
    expect(
      formatInsertHossiiErrorMessage(
        "Could not find the 'tags' column of 'hossiis' in the schema cache",
        'PGRST204',
      ),
    ).toContain('スキーマ');
    expect(mapInsertFailureReason('', 'PGRST204')).toBe('schema_column_mismatch');
  });

  it('appends error code in development display', () => {
    vi.stubEnv('VITE_APP_ENV', 'development');
    expect(
      formatPostFailureForDisplay({
        message: '投稿を保存できませんでした。',
        reason: 'pane_unavailable',
      }),
    ).toContain('エラーコード: pane_unavailable');
    vi.unstubAllEnvs();
  });
});
