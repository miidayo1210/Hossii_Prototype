import { describe, it, expect } from 'vitest';
import {
  HOSSII_CONNECTION_STRENGTH_LABELS,
  getHossiiConnectionStrengthLabel,
} from './hossiiConnectionStrengthLabels';

describe('hossiiConnectionStrengthLabels', () => {
  it('defines soft, medium, and strong labels', () => {
    expect(HOSSII_CONNECTION_STRENGTH_LABELS.map((entry) => entry.value)).toEqual([
      'soft',
      'medium',
      'strong',
    ]);
  });

  it('returns label metadata for a strength', () => {
    expect(getHossiiConnectionStrengthLabel('medium').title).toBe('やわらか');
  });
});
