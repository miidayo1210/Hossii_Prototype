export type AccountSection = 'home' | 'profile' | 'spaces' | 'my-hossii';

const ACCOUNT_SECTION_PARAMS: Record<string, AccountSection> = {
  profile: 'profile',
  spaces: 'spaces',
  'my-hossii': 'my-hossii',
  home: 'home',
};

/** Resolve account screen section from router `screenParam` (`#account/{param}`). */
export function resolveAccountSection(screenParam?: string): AccountSection {
  if (!screenParam) {
    return 'home';
  }
  return ACCOUNT_SECTION_PARAMS[screenParam] ?? 'home';
}

export function accountSectionToParam(section: AccountSection): string | undefined {
  return section === 'home' ? undefined : section;
}
