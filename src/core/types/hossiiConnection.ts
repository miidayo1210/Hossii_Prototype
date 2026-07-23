export type HossiiConnectionStrength = 'soft' | 'medium' | 'strong';

export type HossiiConnectionReasonEmoji =
  | '💡'
  | '🔗'
  | '🌱'
  | '💬'
  | '↔️'
  | '🎯'
  | '❤️'
  | '❓';

export type HossiiConnection = {
  id: string;
  spaceId: string;
  paneId: string;
  sourceHossiiId: string;
  targetHossiiId: string;
  strength: HossiiConnectionStrength;
  reasonText: string | null;
  reasonEmoji: HossiiConnectionReasonEmoji | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HossiiConnectionRow = {
  id: string;
  space_id: string;
  pane_id: string;
  source_hossii_id: string;
  target_hossii_id: string;
  strength: HossiiConnectionStrength;
  reason_text?: string | null;
  reason_emoji?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const HOSSII_CONNECTION_STRENGTHS: readonly HossiiConnectionStrength[] = [
  'soft',
  'medium',
  'strong',
] as const;

export const HOSSII_CONNECTION_REASON_EMOJIS: readonly HossiiConnectionReasonEmoji[] = [
  '💡',
  '🔗',
  '🌱',
  '💬',
  '↔️',
  '🎯',
  '❤️',
  '❓',
] as const;

export function isHossiiConnectionStrength(value: string): value is HossiiConnectionStrength {
  return (HOSSII_CONNECTION_STRENGTHS as readonly string[]).includes(value);
}

export function isHossiiConnectionReasonEmoji(
  value: string,
): value is HossiiConnectionReasonEmoji {
  return (HOSSII_CONNECTION_REASON_EMOJIS as readonly string[]).includes(value);
}
