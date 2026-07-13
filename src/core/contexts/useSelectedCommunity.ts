import { createContext, useContext } from 'react';
import type { MyCommunityMembership } from '../types/communityMembership';

export type SelectedCommunityContextValue = {
  memberships: MyCommunityMembership[];
  selectedCommunityId: string | null;
  selectedMembership: MyCommunityMembership | null;
  loading: boolean;
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
