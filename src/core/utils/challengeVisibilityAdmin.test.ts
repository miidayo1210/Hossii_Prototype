import { describe, expect, it } from 'vitest';
import {
  challengeResponseVisibilityLabel,
  coerceChallengeResponseVisibility,
  coerceOptionalChallengeResponseVisibility,
  resolveChallengeResponseVisibility,
} from './challengeVisibility';
import { normalizeChallengeResponseVisibility } from './challengeResponseValidation';
import {
  normalizeCreateChallengeItemInput,
  normalizeCreateChallengeProgramInput,
  normalizeUpdateChallengeItemInput,
  normalizeUpdateChallengeProgramInput,
} from './challengeValidation';
import {
  buildCreateChallengeItemPayload,
  buildCreateChallengeProgramPayload,
  buildUpdateChallengeItemPayload,
  buildUpdateChallengeProgramPayload,
  rowToChallengeItem,
  rowToChallengeProgram,
} from './challengeProgramsApi';
import { hasUnsavedProgramEdits } from './challengeAdminDisplay';

describe('challenge visibility helpers', () => {
  it('resolves item override over program default', () => {
    expect(
      resolveChallengeResponseVisibility({
        itemResponseVisibility: 'self_only',
        programDefaultResponseVisibility: 'space_members',
      }),
    ).toBe('self_only');
    expect(
      resolveChallengeResponseVisibility({
        itemResponseVisibility: null,
        programDefaultResponseVisibility: 'space_members',
      }),
    ).toBe('space_members');
    expect(
      resolveChallengeResponseVisibility({
        itemResponseVisibility: null,
        programDefaultResponseVisibility: null,
      }),
    ).toBe('manager_only');
  });

  it('accepts three visibility values in response validation', () => {
    expect(normalizeChallengeResponseVisibility('space_members')).toEqual({
      ok: true,
      value: 'space_members',
    });
    expect(normalizeChallengeResponseVisibility('public').ok).toBe(false);
    expect(challengeResponseVisibilityLabel('manager_only')).toContain('管理者');
  });
});

describe('challenge program/item visibility validation and API payloads', () => {
  it('defaults program visibility to manager_only on create', () => {
    const normalized = normalizeCreateChallengeProgramInput({
      spaceId: 'space-1',
      title: '挑戦',
    });
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(normalized.value.defaultResponseVisibility).toBe('manager_only');
    expect(buildCreateChallengeProgramPayload(normalized.value)).toMatchObject({
      default_response_visibility: 'manager_only',
    });
  });

  it('maps program and item visibility columns from rows', () => {
    const program = rowToChallengeProgram({
      id: 'p1',
      space_id: 's1',
      title: 't',
      description: null,
      status: 'draft',
      default_response_visibility: 'space_members',
      created_by: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    expect(program.defaultResponseVisibility).toBe('space_members');

    const item = rowToChallengeItem({
      id: 'i1',
      program_id: 'p1',
      item_type: 'question',
      title: 'q',
      description: null,
      reason: null,
      response_type: 'comment',
      is_required: true,
      sort_order: 0,
      response_visibility: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    expect(item.responseVisibility).toBeNull();
    expect(coerceOptionalChallengeResponseVisibility('self_only')).toBe('self_only');
    expect(coerceChallengeResponseVisibility('nope')).toBe('manager_only');
  });

  it('includes nullable item override in create/update payloads', () => {
    const created = normalizeCreateChallengeItemInput({
      programId: 'p1',
      title: '問い',
      responseVisibility: 'self_only',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(buildCreateChallengeItemPayload(created.value)).toMatchObject({
      response_visibility: 'self_only',
    });

    const updated = normalizeUpdateChallengeItemInput({
      responseVisibility: null,
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(buildUpdateChallengeItemPayload(updated.value)).toEqual({
      response_visibility: null,
    });

    const programUpdate = normalizeUpdateChallengeProgramInput({
      defaultResponseVisibility: 'space_members',
    });
    expect(programUpdate.ok).toBe(true);
    if (!programUpdate.ok) return;
    expect(buildUpdateChallengeProgramPayload(programUpdate.value)).toEqual({
      default_response_visibility: 'space_members',
    });
  });

  it('tracks unsaved program visibility edits', () => {
    expect(
      hasUnsavedProgramEdits({
        title: 'a',
        description: '',
        defaultResponseVisibility: 'self_only',
        savedTitle: 'a',
        savedDescription: null,
        savedDefaultResponseVisibility: 'manager_only',
      }),
    ).toBe(true);
  });
});
