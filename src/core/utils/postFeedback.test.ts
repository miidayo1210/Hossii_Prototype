import { describe, expect, it } from 'vitest';
import { formatInsertHossiiErrorMessage } from './postFeedback';

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
});
