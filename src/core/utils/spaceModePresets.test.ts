import { describe, expect, it } from 'vitest';
import { SPACE_MODE_PRESETS } from './spaceModePresets';

describe('SPACE_MODE_PRESETS', () => {
  it('plaza matches §7.3 values', () => {
    const plaza = SPACE_MODE_PRESETS.find((p) => p.id === 'plaza')!;
    expect(plaza.patch.isPrivate).toBe(false);
    expect(plaza.patch.likesEnabled).toBe(true);
    expect(plaza.patch.positionMode).toBe('selector');
    expect(plaza.patch.randomRecallEnabled).toBe(false);
    expect(plaza.patch.bubbleEditPermission).toBe('all');
    expect(plaza.patch.postFields?.tags?.enabled).toBe(true);
    expect(plaza.patch.postFields?.photo?.enabled).toBe(true);
  });

  it('reflection matches §7.3 values', () => {
    const reflection = SPACE_MODE_PRESETS.find((p) => p.id === 'reflection')!;
    expect(reflection.patch.isPrivate).toBe(true);
    expect(reflection.patch.likesEnabled).toBe(false);
    expect(reflection.patch.positionMode).toBe('auto');
    expect(reflection.patch.randomRecallEnabled).toBe(true);
    expect(reflection.patch.bubbleEditPermission).toBe('owner_and_admin');
    expect(reflection.patch.postFields?.message?.enabled).toBe(true);
    expect(reflection.patch.postFields?.emotion?.enabled).toBe(true);
    expect(reflection.patch.postFields?.tags?.enabled).toBe(true);
  });

  it('workshop matches §7.3 values', () => {
    const workshop = SPACE_MODE_PRESETS.find((p) => p.id === 'workshop')!;
    expect(workshop.patch.likesEnabled).toBe(true);
    expect(workshop.patch.positionMode).toBe('selector');
    expect(workshop.patch.postFields?.message).toEqual({ enabled: true, required: true });
    expect(workshop.patch.postFields?.tags?.enabled).toBe(true);
    expect(workshop.patch.postFields?.photo?.enabled).toBe(true);
    expect(workshop.patch.postFields?.numberPost?.enabled).toBe(true);
  });

  it('event matches §7.3 values', () => {
    const event = SPACE_MODE_PRESETS.find((p) => p.id === 'event')!;
    expect(event.patch.isPrivate).toBe(false);
    expect(event.patch.likesEnabled).toBe(true);
    expect(event.patch.positionMode).toBe('auto');
    expect(event.patch.postFields?.emotion?.enabled).toBe(true);
    expect(event.patch.postFields?.tags?.enabled).toBe(true);
    expect(event.patch.postFields?.message).toEqual({ enabled: true, required: false });
  });
});
