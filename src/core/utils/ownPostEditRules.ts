import type { Hossii, HossiiVisibility } from '../types';

/**
 * 本文編集後の投稿が「空投稿」にならないかを判定する純関数（Phase 2D-2）。
 *
 * 既存の投稿ルール（addHossii）に合わせ、本文が空でも emotion / 画像 / 数値 / 笑い のいずれかが
 * あれば有効とする。テキストのみの投稿を空文字へ編集しようとした場合だけ拒否する。
 * message の内容は変更せず、trim 後の空判定にのみ使う。
 */
export function isEditedMessageValid(
  hossii: Pick<Hossii, 'emotion' | 'imageUrl' | 'numberValue' | 'autoType'>,
  message: string,
): boolean {
  if (message.trim().length > 0) return true;
  return (
    Boolean(hossii.emotion) ||
    Boolean(hossii.imageUrl) ||
    hossii.numberValue != null ||
    hossii.autoType === 'laughter'
  );
}

/** 公開範囲の切り替え先を返す（public <-> owner_only）。未設定は public 扱い。 */
export function nextVisibilityToggle(
  visibility: HossiiVisibility | undefined,
): HossiiVisibility {
  return visibility === 'owner_only' ? 'public' : 'owner_only';
}
