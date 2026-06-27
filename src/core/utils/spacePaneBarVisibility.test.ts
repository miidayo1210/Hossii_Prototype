import { describe, expect, it } from 'vitest';
import { shouldShowSpacePaneBar } from './spacePaneBarVisibility';

describe('shouldShowSpacePaneBar', () => {
  it('hides when visiting', () => {
    expect(shouldShowSpacePaneBar(false, 3, true, false)).toBe(false);
  });

  it('hides while panes loading', () => {
    expect(shouldShowSpacePaneBar(true, 1, false, true)).toBe(false);
  });

  it('shows for admin with one pane', () => {
    expect(shouldShowSpacePaneBar(true, 1, false, false)).toBe(true);
  });

  it('hides for member with one pane', () => {
    expect(shouldShowSpacePaneBar(false, 1, false, false)).toBe(false);
  });

  it('shows for member with two or more panes', () => {
    expect(shouldShowSpacePaneBar(false, 2, false, false)).toBe(true);
  });
});
