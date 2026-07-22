export type HossiiConnectionStrength = 'soft' | 'medium' | 'strong';

export type HossiiConnection = {
  id: string;
  spaceId: string;
  paneId: string;
  sourceHossiiId: string;
  targetHossiiId: string;
  strength: HossiiConnectionStrength;
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
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const HOSSII_CONNECTION_STRENGTHS: readonly HossiiConnectionStrength[] = [
  'soft',
  'medium',
  'strong',
] as const;

export function isHossiiConnectionStrength(value: string): value is HossiiConnectionStrength {
  return (HOSSII_CONNECTION_STRENGTHS as readonly string[]).includes(value);
}
