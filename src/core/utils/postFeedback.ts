export type PostFailureDetail = {
  message: string;
  reason?: string;
};

export const POST_FAILURE_EVENT = 'hossii:post-failure';

export function emitPostFailure(detail: PostFailureDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<PostFailureDetail>(POST_FAILURE_EVENT, { detail }));
}

export function formatInsertHossiiErrorMessage(errorMessage: string): string {
  const lower = errorMessage.toLowerCase();
  if (lower.includes('space_id') && lower.includes('foreign key')) {
    return '投稿を保存できませんでした。このスペースはDevelopment環境に存在しません。';
  }
  if (lower.includes('space_pane_id') || lower.includes('foreign key')) {
    return '投稿を保存できませんでした。Development環境のスペースとタブ設定を確認してください。';
  }
  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return '投稿を保存できませんでした。Development環境の参加設定を確認してください。';
  }
  return '投稿を保存できませんでした。しばらくしてから再度お試しください。';
}
