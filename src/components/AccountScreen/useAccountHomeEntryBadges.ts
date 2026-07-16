import { useEffect, useState } from 'react';
import { useAuth } from '../../core/contexts/useAuth';
import { fetchMyJoinedSpaces } from '../../core/utils/joinedSpacesApi';
import {
  fetchMyHossiiSettings,
  isMyHossiiRegistered,
} from '../../core/utils/userProfilesApi';

export type AccountHomeEntryBadges = {
  spaces: string | null;
  myHossii: string | null;
  loading: boolean;
};

const GUEST_BADGES: AccountHomeEntryBadges = {
  spaces: null,
  myHossii: null,
  loading: false,
};

const INITIAL_LOGGED_IN_BADGES: AccountHomeEntryBadges = {
  spaces: null,
  myHossii: null,
  loading: true,
};

export function useAccountHomeEntryBadges(): AccountHomeEntryBadges {
  const { currentUser } = useAuth();
  const [badges, setBadges] = useState<AccountHomeEntryBadges>(INITIAL_LOGGED_IN_BADGES);

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setBadges(INITIAL_LOGGED_IN_BADGES);
      }
    });

    (async () => {
      try {
        const [spaces, settings] = await Promise.all([
          fetchMyJoinedSpaces(),
          fetchMyHossiiSettings(currentUser.uid),
        ]);
        if (cancelled) return;

        setBadges({
          spaces: `${spaces.length}件`,
          myHossii: isMyHossiiRegistered(settings) ? '登録済み' : '未登録',
          loading: false,
        });
      } catch {
        if (cancelled) return;
        setBadges({
          spaces: '取得不可',
          myHossii: '取得不可',
          loading: false,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  if (!currentUser) {
    return GUEST_BADGES;
  }

  return badges;
}

function badgeForSection(
  section: 'profile' | 'spaces' | 'my-hossii',
  badges: AccountHomeEntryBadges,
): string | null {
  if (badges.loading) return '…';
  switch (section) {
    case 'spaces':
      return badges.spaces;
    case 'my-hossii':
      return badges.myHossii;
    default:
      return null;
  }
}

export { badgeForSection };
