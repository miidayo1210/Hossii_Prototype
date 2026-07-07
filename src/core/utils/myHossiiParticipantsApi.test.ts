import { describe, expect, it } from 'vitest';
import { parseRpcRowForTest } from './myHossiiParticipantsApi';

describe('myHossiiParticipantsApi', () => {
  it('parses preset participant row', () => {
    const participant = parseRpcRowForTest({
      user_id: '11111111-1111-1111-1111-111111111111',
      nickname: 'テスト',
      hossii_source_type: 'preset',
      hossii_preset_key: 'idle_base',
      hossii_image_path: null,
      hossii_updated_at: '2026-07-07T00:00:00Z',
    });
    expect(participant?.userId).toBe('11111111-1111-1111-1111-111111111111');
    expect(participant?.hossiiSourceType).toBe('preset');
    expect(participant?.hossiiPresetKey).toBe('idle_base');
  });

  it('rejects invalid source type', () => {
    const participant = parseRpcRowForTest({
      user_id: '11111111-1111-1111-1111-111111111111',
      nickname: 'テスト',
      hossii_source_type: 'invalid',
      hossii_preset_key: null,
      hossii_image_path: null,
      hossii_updated_at: null,
    });
    expect(participant).toBeNull();
  });
});
