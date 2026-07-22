import { describe, expect, it } from 'vitest';
import { buildConnectionPath, CONNECTION_STRENGTH_STYLES } from './connectionPath';

describe('buildConnectionPath', () => {
  const from = { x: 10, y: 20 };
  const to = { x: 110, y: 120 };

  it('returns quadratic bezier path', () => {
    const path = buildConnectionPath(from, to, 'medium');
    expect(path).toMatch(/^M 10 20 Q .+ 110 120$/);
  });

  it('uses lower curvature for strong connections', () => {
    const soft = buildConnectionPath(from, to, 'soft');
    const strong = buildConnectionPath(from, to, 'strong');
    expect(soft).not.toEqual(strong);
    expect(CONNECTION_STRENGTH_STYLES.strong.curvature).toBeLessThan(
      CONNECTION_STRENGTH_STYLES.soft.curvature,
    );
  });

  it('assigns thicker stroke to stronger connections', () => {
    expect(CONNECTION_STRENGTH_STYLES.strong.strokeWidth).toBeGreaterThan(
      CONNECTION_STRENGTH_STYLES.soft.strokeWidth,
    );
    expect(CONNECTION_STRENGTH_STYLES.medium.strokeWidth).toBeGreaterThan(
      CONNECTION_STRENGTH_STYLES.soft.strokeWidth,
    );
  });
});
