export const LIKE_MUTATION_ERROR_MESSAGE = 'いいねを反映できませんでした';

export type OptimisticLikePreview = {
  liked: boolean;
  count: number;
};

/** 楽観 UI 用: ログインは toggle、ゲストは increment の見た目を返す */
export function previewOptimisticLikeState(params: {
  isLoggedIn: boolean;
  wasLiked: boolean;
  baseCount: number;
}): OptimisticLikePreview {
  const baseCount = Math.max(0, params.baseCount);
  if (params.isLoggedIn) {
    const liked = !params.wasLiked;
    const count = Math.max(0, baseCount + (liked ? 1 : -1));
    return { liked, count };
  }
  return { liked: true, count: baseCount + 1 };
}
