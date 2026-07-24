import { describe, expect, it } from 'vitest';
import {
  TYPE_B_PROVISIONAL_BUBBLE_HEIGHT_PX,
  TYPE_B_PROVISIONAL_BUBBLE_WIDTH_PX,
  buildTypeBProvisionalTargetRect,
} from './typeBProvisionalThreadGeometry';

describe('buildTypeBProvisionalTargetRect', () => {
  it('centers the pseudo bubble on the placement point', () => {
    const rect = buildTypeBProvisionalTargetRect({ x: 200, y: 120 });

    expect(rect.width).toBe(TYPE_B_PROVISIONAL_BUBBLE_WIDTH_PX);
    expect(rect.height).toBe(TYPE_B_PROVISIONAL_BUBBLE_HEIGHT_PX);
    expect(rect.left + rect.width / 2).toBe(200);
    expect(rect.top + rect.height / 2).toBe(120);
  });
});
