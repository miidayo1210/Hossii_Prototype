export type PostFailureDetail = {
  message: string;
  reason?: string;
  code?: string;
};

export const POST_FAILURE_EVENT = 'hossii:post-failure';

export function emitPostFailure(detail: PostFailureDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<PostFailureDetail>(POST_FAILURE_EVENT, { detail }));
}

export function mapInsertFailureReason(
  errorMessage: string,
  code?: string,
): string {
  if (code === 'PGRST204') return 'schema_column_mismatch';
  const lower = errorMessage.toLowerCase();
  if (lower.includes('could not find') && lower.includes('column')) {
    return 'schema_column_mismatch';
  }
  if (lower.includes('space_pane_id does not belong')) return 'pane_space_mismatch';
  if (lower.includes('space_id') && lower.includes('foreign key')) return 'space_unavailable';
  if (lower.includes('space_pane_id') || lower.includes('foreign key')) {
    return 'pane_unavailable';
  }
  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'permission_denied';
  }
  return 'insert_failed';
}

export function formatInsertHossiiErrorMessage(errorMessage: string, code?: string): string {
  const lower = errorMessage.toLowerCase();
  if (
    code === 'PGRST204' ||
    (lower.includes('could not find') && lower.includes('column'))
  ) {
    return '投稿を保存できませんでした。Development DBのスキーマがアプリと一致していません。';
  }
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

/** Development では安全な範囲で reason / code をトーストに付与する */
export function formatPostFailureForDisplay(detail: PostFailureDetail): string {
  const label = detail.reason ?? detail.code;
  if (import.meta.env.VITE_APP_ENV === 'development' && label) {
    return `${detail.message}\nエラーコード: ${label}`;
  }
  return detail.message;
}
