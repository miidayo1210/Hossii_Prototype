import type { AppUser } from '../contexts/AuthContext';

export type AccountIdentityStatus =
  | 'account'
  | 'participant'
  | 'guest';

export type ResolveAccountIdentityParams = {
  currentUser: AppUser | null;
  spaceNickname?: string | null;
  communityNickname?: string | null;
  profileNickname?: string | null;
};

export type AccountIdentity = {
  displayName: string;
  status: AccountIdentityStatus;
  statusLabel: string;
  greeting: string;
};

const ACCOUNT_GREETINGS = [
  (name: string) => `${name}さん、おかえり！`,
  (name: string) => `${name}さん、今日はどんな一日だった？`,
  (name: string) => `${name}さん、待ってたよ〜`,
] as const;

const GUEST_GREETINGS = [
  'いまはゲストで参加しているよ',
  'ログインすると、自分の記録をあとから見られるよ',
] as const;

function pickStableGreeting<T>(options: readonly T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return options[hash % options.length]!;
}

function resolveDisplayName(params: ResolveAccountIdentityParams): string {
  if (!params.currentUser) return 'ゲスト';

  const space = params.spaceNickname?.trim();
  if (space) return space;

  const community = params.communityNickname?.trim();
  if (community) return community;

  const profile = params.profileNickname?.trim();
  if (profile) return profile;

  const username = params.currentUser?.username?.trim();
  if (username) return username;

  const displayName = params.currentUser?.displayName?.trim();
  if (displayName) return displayName;

  return 'ゲスト';
}

function resolveStatus(currentUser: AppUser | null): AccountIdentityStatus {
  if (!currentUser) return 'guest';
  if (currentUser.isIssuedParticipant === true) return 'participant';
  return 'account';
}

function statusLabelFor(status: AccountIdentityStatus): string {
  switch (status) {
    case 'participant':
      return '参加IDでログイン中';
    case 'account':
      return 'アカウントでログイン中';
    default:
      return 'ゲスト参加中';
  }
}

/**
 * AccountScreen 向けの表示名・状態ラベル・短い語りかけを解決する。
 * email / ID は返さない。
 */
export function resolveAccountIdentity(params: ResolveAccountIdentityParams): AccountIdentity {
  const status = resolveStatus(params.currentUser);
  const displayName = resolveDisplayName(params);
  const statusLabel = statusLabelFor(status);

  if (status === 'guest') {
    const greeting = pickStableGreeting(GUEST_GREETINGS, 'guest');
    return { displayName, status, statusLabel, greeting };
  }

  const greeting = pickStableGreeting(ACCOUNT_GREETINGS, params.currentUser!.uid)(displayName);
  return { displayName, status, statusLabel, greeting };
}
