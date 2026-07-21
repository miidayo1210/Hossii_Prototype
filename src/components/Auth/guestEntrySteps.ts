import type { ParticipationMode } from '../../core/types/space';
import type { SpaceNicknames } from '../../core/types/profile';

export type GuestEntryStep = 'select' | 'nickname' | 'revisit';

export function resolveInitialStep(
  spaceNicknames: SpaceNicknames,
  spaceId: string,
  participationMode: ParticipationMode,
): GuestEntryStep {
  if (participationMode === 'account_only') {
    return 'select';
  }
  return spaceNicknames[spaceId]?.trim() ? 'revisit' : 'select';
}

/** UI 表示用 step。account_only では revisit / nickname を select へ落とす。 */
export function resolveDisplayStep(
  step: GuestEntryStep,
  participationMode: ParticipationMode,
  savedSpaceNickname: string,
): GuestEntryStep {
  if (participationMode === 'account_only') {
    if (step === 'revisit' || step === 'nickname') {
      return 'select';
    }
    return step;
  }
  if (step === 'revisit' && !savedSpaceNickname.trim()) {
    return 'select';
  }
  return step;
}

/** participationMode が変わったときだけ step を補正する（「別の方法で参加」後の select は維持しないケースは mode 変更時）。 */
export function resolveStepAfterModeChange(
  currentStep: GuestEntryStep,
  spaceNicknames: SpaceNicknames,
  spaceId: string,
  participationMode: ParticipationMode,
): GuestEntryStep {
  if (participationMode === 'account_only') {
    if (currentStep === 'revisit' || currentStep === 'nickname') {
      return 'select';
    }
    return currentStep;
  }

  const saved = Boolean(spaceNicknames[spaceId]?.trim());
  if (saved) {
    if (currentStep === 'nickname') {
      return 'nickname';
    }
    return 'revisit';
  }

  if (currentStep === 'nickname') {
    return 'nickname';
  }
  if (currentStep === 'revisit') {
    return 'select';
  }
  return currentStep;
}

export function shouldShowGuestCard(participationMode: ParticipationMode): boolean {
  return participationMode === 'guest_only' || participationMode === 'guest_and_account';
}

export function shouldShowAccountCard(participationMode: ParticipationMode): boolean {
  return participationMode === 'guest_and_account' || participationMode === 'account_only';
}

export function getSelectPrompt(participationMode: ParticipationMode): string {
  switch (participationMode) {
    case 'guest_only':
      return 'ゲストとして参加してね';
    case 'account_only':
      return '参加IDで参加してね';
    default:
      return 'どの方法で参加する？';
  }
}

export function getAccountCardDescription(participationMode: ParticipationMode): string {
  if (participationMode === 'account_only') {
    return '案内された参加IDとパスワードを入力します';
  }
  return '参加した情報を引き継げます';
}

export function shouldShowRevisit(
  participationMode: ParticipationMode,
  savedSpaceNickname: string,
): boolean {
  if (participationMode === 'account_only') {
    return false;
  }
  return Boolean(savedSpaceNickname.trim());
}
