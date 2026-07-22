/**
 * Bubble 辺の接続点 inset（px）。
 * 実 DOM（1280×800 / 1440×900）で like badge・owner bar 回避を確認し定数化。
 */
export type ConnectionEdgeInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/** 吹き出し本体からの基本 inset（12–16px 帯の中央値） */
export const CONNECTION_BASE_EDGE_PADDING_PX = 14;

/** .likeFloatingBadge（bottom: -0.875rem ≈14px, バッジ幅 ≈22px）分の追加 inset */
export const CONNECTION_LIKE_BADGE_INSET_PX = {
  bottom: 14,
  right: 12,
} as const;

/** .bubbleOwnerBar（top: calc(100% + 8px), 高さ ≈28px）分の追加 inset */
export const CONNECTION_OWNER_BAR_INSET_PX = {
  bottom: 36,
} as const;

export type BubbleAnchorHints = {
  hasLikeBadge: boolean;
  hasOwnerBar: boolean;
};

export function resolveConnectionEdgeInsets(
  hints: BubbleAnchorHints,
  basePadding = CONNECTION_BASE_EDGE_PADDING_PX,
): ConnectionEdgeInsets {
  return {
    top: basePadding,
    left: basePadding,
    right: basePadding + (hints.hasLikeBadge ? CONNECTION_LIKE_BADGE_INSET_PX.right : 0),
    bottom:
      basePadding +
      (hints.hasLikeBadge ? CONNECTION_LIKE_BADGE_INSET_PX.bottom : 0) +
      (hints.hasOwnerBar ? CONNECTION_OWNER_BAR_INSET_PX.bottom : 0),
  };
}

export function insetRect(
  rect: { left: number; top: number; width: number; height: number },
  insets: ConnectionEdgeInsets,
): { left: number; top: number; width: number; height: number } {
  const width = Math.max(0, rect.width - insets.left - insets.right);
  const height = Math.max(0, rect.height - insets.top - insets.bottom);
  return {
    left: rect.left + insets.left,
    top: rect.top + insets.top,
    width,
    height,
  };
}
