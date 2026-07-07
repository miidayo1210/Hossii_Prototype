export type AddHossiiBlockReason =
  | 'empty_input'
  | 'pane_unavailable'
  | 'space_unavailable'
  | 'pane_space_mismatch';

export type AddHossiiBlock = {
  reason: AddHossiiBlockReason;
  message: string;
};

export function buildAddHossiiBlockMessage(reason: AddHossiiBlockReason): string {
  switch (reason) {
    case 'empty_input':
      return '投稿内容を入力してください。';
    case 'pane_unavailable':
      return '投稿を保存できませんでした。スペースのタブが読み込まれていません。';
    case 'space_unavailable':
      return 'このスペースはDevelopment環境に存在しません。Developmentのseedスペースを開いてください。';
    case 'pane_space_mismatch':
      return '投稿を保存できませんでした。Development環境のタブ設定を確認してください。';
    default:
      return '投稿を保存できませんでした。';
  }
}

export function isKnownSpaceInState(
  spaceId: string,
  spaceIds: readonly string[],
): boolean {
  return spaceIds.includes(spaceId);
}
