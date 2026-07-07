import type { MyHossiiLogVisibility } from '../types/myHossii';
import type { AppUser } from '../contexts/AuthContext';
import type { ParticipantEligibility, ParticipantEligibilityReason } from './myHossiiParticipationApi';
import type { MyHossiiSettings } from './userProfilesApi';
import { isMyHossiiRegistered } from './userProfilesApi';

export type { ParticipantEligibility, ParticipantEligibilityReason };

export type MyHossiiSpaceAppearanceInput = {
  isRegistered: boolean;
  spaceMyHossiiEnabled: boolean;
  participantEligibility: ParticipantEligibility;
  participantReason?: ParticipantEligibilityReason;
  /** 行なしは true（初期 ON） */
  userPreferenceVisible: boolean;
};

/** マイHossii登録済みかつ参加資格がある（スペース機能ON/OFF・本人設定は含まない） */
export function canAppearInSpace(input: MyHossiiSpaceAppearanceInput): boolean {
  return (
    input.isRegistered &&
    input.participantEligibility === 'eligible'
  );
}

/** スペース HOME に実際に表示されるか */
export function isVisibleInSpace(input: MyHossiiSpaceAppearanceInput): boolean {
  return (
    canAppearInSpace(input) &&
    input.spaceMyHossiiEnabled &&
    input.userPreferenceVisible
  );
}

export type MyHossiiAccountUiState =
  | 'unregistered'
  | 'registered_visible'
  | 'registered_hidden_by_user'
  | 'registered_space_off'
  | 'registered_not_participant'
  | 'registered_revoked'
  | 'registered_appearance_error';

export function resolveMyHossiiAccountUiState(
  input: MyHossiiSpaceAppearanceInput,
): MyHossiiAccountUiState {
  if (!input.isRegistered) return 'unregistered';

  if (input.participantEligibility === 'revoked') return 'registered_revoked';
  if (input.participantEligibility === 'error') return 'registered_appearance_error';
  if (!input.spaceMyHossiiEnabled) return 'registered_space_off';
  if (input.participantEligibility === 'not_participant') return 'registered_not_participant';
  if (!input.userPreferenceVisible) return 'registered_hidden_by_user';
  return 'registered_visible';
}

export function buildMyHossiiSpaceAppearanceInput(params: {
  myHossiiSettings: MyHossiiSettings;
  spaceMyHossiiEnabled: boolean;
  participantEligibility: ParticipantEligibility;
  participantReason?: ParticipantEligibilityReason;
  userPreferenceVisible: boolean;
}): MyHossiiSpaceAppearanceInput {
  return {
    isRegistered: isMyHossiiRegistered(params.myHossiiSettings),
    spaceMyHossiiEnabled: params.spaceMyHossiiEnabled,
    participantEligibility: params.participantEligibility,
    participantReason: params.participantReason,
    userPreferenceVisible: params.userPreferenceVisible,
  };
}

export function getRegistrationSuccessMessage(
  input: MyHossiiSpaceAppearanceInput,
  spaceName?: string | null,
): string {
  const spaceLabel = spaceName ? `このスペース` : 'このスペース';

  if (!input.isRegistered) {
    return 'マイHossiiを登録しました。';
  }

  if (input.participantEligibility === 'revoked') {
    return `マイHossiiを登録しました。\n\n${spaceLabel}では現在、マイHossiiを登場させることができません。`;
  }

  if (input.participantEligibility === 'error') {
    return `マイHossiiを登録しました。\n\n${spaceLabel}での登場状態を確認できませんでした。`;
  }

  if (!input.spaceMyHossiiEnabled) {
    return `マイHossiiを登録しました。\n\n${spaceLabel}では、管理者が機能をONにすると登場できます。`;
  }

  if (input.participantEligibility === 'not_participant') {
    if (input.participantReason === 'default_nickname_only') {
      return `マイHossiiを登録しました。\n\n${spaceLabel}で使うニックネームを設定すると登場できます。`;
    }
    return `マイHossiiを登録しました。\n\n${spaceLabel}では参加者として認識されていないため、\n現在は登場できません。`;
  }

  if (input.userPreferenceVisible) {
    return `マイHossiiを登録しました。\n${spaceLabel}に登場します。`;
  }

  return `マイHossiiを登録しました。\n\n${spaceLabel}では非表示に設定されています。`;
}

export function shouldShowSpaceRegistrationPrompt(input: {
  spaceMyHossiiEnabled: boolean;
  participantEligibility: ParticipantEligibility;
  isRegistered: boolean;
  isAuthenticated: boolean;
}): boolean {
  return (
    input.isAuthenticated &&
    input.spaceMyHossiiEnabled &&
    input.participantEligibility === 'eligible' &&
    !input.isRegistered
  );
}

export function isAdminUser(user: AppUser | null | undefined): boolean {
  return user?.isAdmin === true;
}

/** マイHossiiポップオーバー内「この人のログを見る」の表示可否 */
export function shouldShowMyHossiiLogButton(
  logVisibility: MyHossiiLogVisibility,
  isAuthenticatedViewer: boolean,
): boolean {
  return (
    logVisibility === 'public' ||
    (logVisibility === 'authenticated' && isAuthenticatedViewer)
  );
}

/** @internal テスト用 */
export function defaultUserPreferenceVisible(
  stored: boolean | null | undefined,
): boolean {
  return stored ?? true;
}
