import { describe, expect, it } from 'vitest';
import { shouldShowMyHossiiLayer } from './myHossiiLayerVisibility';

describe('shouldShowMyHossiiLayer', () => {
  it('hides when disabled', () => {
    expect(shouldShowMyHossiiLayer(false, true)).toBe(false);
    expect(shouldShowMyHossiiLayer(false, false)).toBe(false);
  });

  it('shows only on default pane when enabled', () => {
    expect(shouldShowMyHossiiLayer(true, true)).toBe(true);
    expect(shouldShowMyHossiiLayer(true, false)).toBe(false);
  });
});
