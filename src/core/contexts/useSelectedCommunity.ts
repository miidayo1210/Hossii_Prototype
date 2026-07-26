import { createContext, useContext } from 'react';
import type { MyCommunityMembership } from '../types/communityMembership';
import type { IssuedParticipantScopeResult } from '../utils/participantAccountScopeApi';

export type SelectedCommunityContextValue = {
  memberships: MyCommunityMembership[];
  selectedCommunityId: string | null;
  selectedMembership: MyCommunityMembership | null;
  loading: boolean;
  /**
   * 参加IDの発行元 scope（SelectedCommunityProvider が取得済み）。
   * 通常アカウントでは常に null。JoinedSpacesSection 等で二重 fetch しないために公開する。
   */
  issuedParticipantScope: IssuedParticipantScopeResult | null;
  setSelectedCommunityId: (id: string | null) => void;
  refreshMemberships: () => Promise<void>;
};

export const SelectedCommunityContext = createContext<SelectedCommunityContextValue | null>(null);

export function useSelectedCommunity(): SelectedCommunityContextValue {
  const ctx = useContext(SelectedCommunityContext);
  if (!ctx) {
    throw new Error('useSelectedCommunity must be used within SelectedCommunityProvider');
  }
  return ctx;
}
