/**
 * StarView プレビューローテの同時スロット数。
 * モバイル縦は既存挙動を維持（84 AC）。
 */
export function computePreviewSlotCount(options: {
  layoutMode: string;
  useStarView: boolean;
  postsWithContentCount: number;
  isMobile: boolean;
  isPortrait: boolean;
  presentationMode: 'bubbles' | 'stars';
}): number {
  const {
    layoutMode,
    useStarView,
    postsWithContentCount,
    isMobile,
    isPortrait,
    presentationMode,
  } = options;

  if (layoutMode === 'byAuthor') return 0;
  if (!useStarView || postsWithContentCount === 0) return 0;

  if (!isMobile && presentationMode === 'stars') {
    return Math.min(postsWithContentCount, 6);
  }

  if (isMobile && isPortrait) {
    if (postsWithContentCount <= 3) return 1;
    return Math.min(3, postsWithContentCount);
  }

  return 0;
}
