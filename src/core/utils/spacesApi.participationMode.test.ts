import { describe, expect, it, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));

vi.mock('../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: h.from,
  },
}));

import { mapSpaceRowToSpace, updateSpaceInDb } from './spacesApi';

const baseRow = {
  id: 'space-1',
  space_url: 'dev-public',
  name: 'Dev Public',
  quick_emotions: ['joy'],
  background: { kind: 'color', value: '#EAF4FF' },
  saved_background_images: null,
  created_at: '2024-01-01T00:00:00.000Z',
};

describe('spacesApi participation_mode mapping', () => {
  it('maps participation_mode via normalizeParticipationMode on read', () => {
    expect(
      mapSpaceRowToSpace({ ...baseRow, participation_mode: 'guest_only' }).participationMode,
    ).toBe('guest_only');
    expect(
      mapSpaceRowToSpace({ ...baseRow, participation_mode: 'account_only' }).participationMode,
    ).toBe('account_only');
    expect(mapSpaceRowToSpace({ ...baseRow }).participationMode).toBe('guest_and_account');
    expect(mapSpaceRowToSpace({ ...baseRow, participation_mode: 'invalid' }).participationMode).toBe(
      'guest_and_account',
    );
  });
});

describe('updateSpaceInDb participationMode patch', () => {
  beforeEach(() => {
    h.update.mockReset();
    h.eq.mockReset();
    h.select.mockReset();
    h.from.mockReset();
    h.select.mockResolvedValue({ data: [{}], error: null });
    h.eq.mockReturnValue({ select: h.select });
    h.update.mockReturnValue({ eq: h.eq });
    h.from.mockReturnValue({ update: h.update });
  });

  it('sends participation_mode only when participationMode is specified', async () => {
    await updateSpaceInDb('space-1', { participationMode: 'account_only' });
    expect(h.update).toHaveBeenCalledWith({ participation_mode: 'account_only' });
  });

  it('does not send participation_mode when patch omits participationMode', async () => {
    await updateSpaceInDb('space-1', { name: 'Renamed' });
    expect(h.update).toHaveBeenCalledWith({ name: 'Renamed' });
    expect(h.update.mock.calls[0][0]).not.toHaveProperty('participation_mode');
  });
});
