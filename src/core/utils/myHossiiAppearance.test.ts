import { describe, expect, it } from 'vitest';
import {
  buildMyHossiiSpaceAppearanceInput,
  canAppearInSpace,
  defaultUserPreferenceVisible,
  getRegistrationSuccessMessage,
  isVisibleInSpace,
  resolveMyHossiiAccountUiState,
  shouldShowMyHossiiLogButton,
  shouldShowSpaceRegistrationPrompt,
} from './myHossiiAppearance';

const emptySettings = {
  sourceType: null,
  presetKey: null,
  imagePath: null,
  customConfig: null,
  updatedAt: null,
} as const;

const registeredPreset = {
  sourceType: 'preset' as const,
  presetKey: 'idle_base',
  imagePath: null,
  customConfig: null,
  updatedAt: '2026-07-07T00:00:00Z',
};

describe('myHossiiAppearance', () => {
  const eligibleVisibleInput = buildMyHossiiSpaceAppearanceInput({
    myHossiiSettings: registeredPreset,
    spaceMyHossiiEnabled: true,
    participantEligibility: 'eligible',
    userPreferenceVisible: true,
  });

  it('canAppearInSpace requires registration and eligible participation', () => {
    expect(canAppearInSpace(eligibleVisibleInput)).toBe(true);
    expect(
      canAppearInSpace({
        ...eligibleVisibleInput,
        isRegistered: false,
      }),
    ).toBe(false);
    expect(
      canAppearInSpace({
        ...eligibleVisibleInput,
        participantEligibility: 'not_participant',
      }),
    ).toBe(false);
    expect(
      canAppearInSpace({
        ...eligibleVisibleInput,
        participantEligibility: 'revoked',
      }),
    ).toBe(false);
  });

  it('isVisibleInSpace also requires space feature ON and user preference ON', () => {
    expect(isVisibleInSpace(eligibleVisibleInput)).toBe(true);
    expect(
      isVisibleInSpace({
        ...eligibleVisibleInput,
        spaceMyHossiiEnabled: false,
      }),
    ).toBe(false);
    expect(
      isVisibleInSpace({
        ...eligibleVisibleInput,
        userPreferenceVisible: false,
      }),
    ).toBe(false);
  });

  it('defaults missing preference rows to visible', () => {
    expect(defaultUserPreferenceVisible(undefined)).toBe(true);
    expect(defaultUserPreferenceVisible(null)).toBe(true);
    expect(defaultUserPreferenceVisible(false)).toBe(false);
  });

  it('resolves account UI states', () => {
    expect(
      resolveMyHossiiAccountUiState({
        isRegistered: false,
        spaceMyHossiiEnabled: true,
        participantEligibility: 'eligible',
        userPreferenceVisible: true,
      }),
    ).toBe('unregistered');

    expect(resolveMyHossiiAccountUiState(eligibleVisibleInput)).toBe('registered_visible');
    expect(
      resolveMyHossiiAccountUiState({
        ...eligibleVisibleInput,
        userPreferenceVisible: false,
      }),
    ).toBe('registered_hidden_by_user');
    expect(
      resolveMyHossiiAccountUiState({
        ...eligibleVisibleInput,
        spaceMyHossiiEnabled: false,
      }),
    ).toBe('registered_space_off');
    expect(
      resolveMyHossiiAccountUiState({
        ...eligibleVisibleInput,
        participantEligibility: 'not_participant',
      }),
    ).toBe('registered_not_participant');
    expect(
      resolveMyHossiiAccountUiState({
        ...eligibleVisibleInput,
        participantEligibility: 'revoked',
      }),
    ).toBe('registered_revoked');
    expect(
      resolveMyHossiiAccountUiState({
        ...eligibleVisibleInput,
        participantEligibility: 'error',
      }),
    ).toBe('registered_appearance_error');
  });

  it('prioritizes space feature OFF over not_participant messaging state', () => {
    expect(
      resolveMyHossiiAccountUiState({
        ...eligibleVisibleInput,
        spaceMyHossiiEnabled: false,
        participantEligibility: 'not_participant',
      }),
    ).toBe('registered_space_off');
  });

  it('returns contextual registration success messages', () => {
    expect(
      getRegistrationSuccessMessage(eligibleVisibleInput, 'テストスペース'),
    ).toContain('登場します');

    expect(
      getRegistrationSuccessMessage({
        ...eligibleVisibleInput,
        spaceMyHossiiEnabled: false,
      }),
    ).toContain('機能をONにすると');

    expect(
      getRegistrationSuccessMessage({
        ...eligibleVisibleInput,
        participantEligibility: 'not_participant',
      }),
    ).toContain('参加者として認識されていない');
  });

  it('shows registration prompt only when eligible and feature enabled', () => {
    expect(
      shouldShowSpaceRegistrationPrompt({
        isAuthenticated: true,
        spaceMyHossiiEnabled: true,
        participantEligibility: 'eligible',
        isRegistered: false,
      }),
    ).toBe(true);

    expect(
      shouldShowSpaceRegistrationPrompt({
        isAuthenticated: true,
        spaceMyHossiiEnabled: false,
        participantEligibility: 'eligible',
        isRegistered: false,
      }),
    ).toBe(false);

    expect(
      shouldShowSpaceRegistrationPrompt({
        isAuthenticated: true,
        spaceMyHossiiEnabled: true,
        participantEligibility: 'not_participant',
        isRegistered: false,
      }),
    ).toBe(false);

    expect(
      shouldShowSpaceRegistrationPrompt({
        isAuthenticated: false,
        spaceMyHossiiEnabled: true,
        participantEligibility: 'eligible',
        isRegistered: false,
      }),
    ).toBe(false);
  });

  it('treats unregistered settings as not registered', () => {
    const input = buildMyHossiiSpaceAppearanceInput({
      myHossiiSettings: emptySettings,
      spaceMyHossiiEnabled: true,
      participantEligibility: 'eligible',
      userPreferenceVisible: true,
    });
    expect(input.isRegistered).toBe(false);
    expect(canAppearInSpace(input)).toBe(false);
  });
});

describe('registration eligibility by account type (logic only)', () => {
  it('guest cannot register when currentUser is null', () => {
    expect(
      shouldShowSpaceRegistrationPrompt({
        isAuthenticated: false,
        spaceMyHossiiEnabled: true,
        participantEligibility: 'eligible',
        isRegistered: false,
      }),
    ).toBe(false);
  });

  it('admin without participation is not visible', () => {
    const input = buildMyHossiiSpaceAppearanceInput({
      myHossiiSettings: registeredPreset,
      spaceMyHossiiEnabled: true,
      participantEligibility: 'not_participant',
      userPreferenceVisible: true,
    });
    expect(isVisibleInSpace(input)).toBe(false);
  });

  it('admin with nickname path can be visible', () => {
    const input = buildMyHossiiSpaceAppearanceInput({
      myHossiiSettings: registeredPreset,
      spaceMyHossiiEnabled: true,
      participantEligibility: 'eligible',
      userPreferenceVisible: true,
    });
    expect(isVisibleInSpace(input)).toBe(true);
  });
});

describe('shouldShowMyHossiiLogButton', () => {
  it('shows for public visibility to guests', () => {
    expect(shouldShowMyHossiiLogButton('public', false)).toBe(true);
  });

  it('hides for authenticated visibility when guest', () => {
    expect(shouldShowMyHossiiLogButton('authenticated', false)).toBe(false);
  });

  it('shows for authenticated visibility when logged in', () => {
    expect(shouldShowMyHossiiLogButton('authenticated', true)).toBe(true);
  });

  it('hides for hidden visibility', () => {
    expect(shouldShowMyHossiiLogButton('hidden', true)).toBe(false);
    expect(shouldShowMyHossiiLogButton('hidden', false)).toBe(false);
  });
});
