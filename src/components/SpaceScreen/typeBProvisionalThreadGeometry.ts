import type { BubbleAnchorHints } from '../../core/utils/connectionAnchorPadding';

export function readBubbleHintsFromElement(el: HTMLElement): BubbleAnchorHints {
  return {
    hasLikeBadge: el.querySelector('[data-like-badge]') != null,
    hasOwnerBar: el.querySelector('[data-owner-actions]') != null,
  };
}
