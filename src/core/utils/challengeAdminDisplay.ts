/** Display helpers for challenge admin UI (no DB source of truth). */

export type ChallengeItemCountStats = {
  total: number;
  required: number;
  optional: number;
};

export function countChallengeItemStats(
  items: ReadonlyArray<{ isRequired: boolean }>,
): ChallengeItemCountStats {
  let required = 0;
  let optional = 0;
  for (const item of items) {
    if (item.isRequired) required += 1;
    else optional += 1;
  }
  return { total: items.length, required, optional };
}

export function clampAdminDescription(
  value: string | null | undefined,
  max = 80,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function formatChallengeResponderLabel(
  userId: string,
  names: Readonly<Record<string, string>>,
): string {
  const resolved = names[userId]?.trim();
  if (resolved) return resolved;
  return `参加者 ${userId.slice(0, 8)}`;
}

export function hasUnsavedProgramEdits(input: {
  title: string;
  description: string;
  savedTitle: string;
  savedDescription: string | null;
}): boolean {
  return (
    input.title !== input.savedTitle ||
    input.description !== (input.savedDescription ?? '')
  );
}
