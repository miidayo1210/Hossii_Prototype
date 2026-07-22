import { describe, expect, it } from 'vitest';
import {
  CONNECTION_BASE_EDGE_PADDING_PX,
  resolveConnectionEdgeInsets,
} from './connectionAnchorPadding';

describe('resolveConnectionEdgeInsets', () => {
  it('uses base padding on all sides when no badges', () => {
    expect(resolveConnectionEdgeInsets({ hasLikeBadge: false, hasOwnerBar: false })).toEqual({
      top: CONNECTION_BASE_EDGE_PADDING_PX,
      right: CONNECTION_BASE_EDGE_PADDING_PX,
      bottom: CONNECTION_BASE_EDGE_PADDING_PX,
      left: CONNECTION_BASE_EDGE_PADDING_PX,
    });
  });

  it('adds like badge padding on bottom-right', () => {
    const insets = resolveConnectionEdgeInsets({ hasLikeBadge: true, hasOwnerBar: false });
    expect(insets.right).toBeGreaterThan(CONNECTION_BASE_EDGE_PADDING_PX);
    expect(insets.bottom).toBeGreaterThan(CONNECTION_BASE_EDGE_PADDING_PX);
  });

  it('adds owner bar padding on bottom', () => {
    const insets = resolveConnectionEdgeInsets({ hasLikeBadge: false, hasOwnerBar: true });
    expect(insets.bottom).toBeGreaterThan(CONNECTION_BASE_EDGE_PADDING_PX);
  });
});
