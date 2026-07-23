import type { TypeAConnectionWriteGateResult } from './typeAConnectionWriteGate';

/** BubbleActionMenu 向け: create 不可理由の短い補足文。joining / error は既存 UI を使うため null。 */
export function formatConnectionCreateBlockedReasonMessage(
  blockReason: TypeAConnectionWriteGateResult['blockReason'],
): string | null {
  switch (blockReason) {
    case 'guest':
      return '参加すると、つながりを作れます';
    case 'membership_none':
      return 'このスペースに参加すると作れます';
    case 'archived':
      return 'アーカイブ中は編集できません';
    default:
      return null;
  }
}
