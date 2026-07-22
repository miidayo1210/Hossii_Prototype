import type { HossiiConnectionStrength } from '../types/hossiiConnection';

export type HossiiConnectionStrengthLabel = {
  value: HossiiConnectionStrength;
  title: string;
  description: string;
};

export const HOSSII_CONNECTION_STRENGTH_LABELS: readonly HossiiConnectionStrengthLabel[] = [
  {
    value: 'soft',
    title: 'ほのか',
    description: 'なんとなく近いかも',
  },
  {
    value: 'medium',
    title: 'やわらか',
    description: '関係がありそう',
  },
  {
    value: 'strong',
    title: 'しっかり',
    description: 'かなりつながっている',
  },
] as const;

export function getHossiiConnectionStrengthLabel(
  strength: HossiiConnectionStrength,
): HossiiConnectionStrengthLabel {
  return HOSSII_CONNECTION_STRENGTH_LABELS.find((entry) => entry.value === strength)!;
}
