import {
  useCallback,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useAuth } from './useAuth';
import { fetchMyCommunityMemberships } from '../utils/communityMembershipsApi';
import type { MyCommunityMembership } from '../types/communityMembership';
import {
  fetchIssuedParticipantAccountScope,
  toIssuedParticipantCommunityMembership,
  type IssuedParticipantScopeResult,
} from '../utils/participantAccountScopeApi';
import { resolveAccountAffiliationSource } from '../utils/resolveAccountAffiliationSource';
import {
  loadStoredCommunityId,
  saveStoredCommunityId,
} from '../utils/selectedCommunityStorage';
import { SelectedCommunityContext } from './useSelectedCommunity';

export function SelectedCommunityProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [memberships, setMemberships] = useState<MyCommunityMembership[]>([]);
  const [issuedParticipantScope, setIssuedParticipantScope] =
    useState<IssuedParticipantScopeResult | null>(null);
  const [selectedCommunityId, setSelectedCommunityIdState] = useState<string | null>(
    () => loadStoredCommunityId(),
  );
  const [loading, setLoading] = useState(false);

  const refreshMemberships = useCallback(async () => {
    if (!currentUser) {
      setMemberships([]);
      setIssuedParticipantScope(null);
      return;
    }
    setLoading(true);
    try {
      // 参加ID: community_memberships 横断は使わず、発行元 community 1 件のみ。
      // 取得失敗時も通常 membership 一覧へ fallback しない。
      if (resolveAccountAffiliationSource(currentUser.isIssuedParticipant) === 'issued_participant_scope') {
        const scope = await fetchIssuedParticipantAccountScope();
        setIssuedParticipantScope(scope);
        if (!scope.ok) {
          console.error('[SelectedCommunity] issued participant scope failed:', scope.reason);
          setMemberships([]);
          return;
        }
        setMemberships([toIssuedParticipantCommunityMembership(scope)]);
        return;
      }

      setIssuedParticipantScope(null);
      const rows = await fetchMyCommunityMemberships();
      setMemberships(rows);
    } catch (error) {
      console.error('[SelectedCommunity] fetch failed:', error);
      setMemberships([]);
      setIssuedParticipantScope(null);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void refreshMemberships();
  }, [refreshMemberships]);

  useEffect(() => {
    if (!currentUser || memberships.length === 0) {
      if (!currentUser) setSelectedCommunityIdState(null);
      return;
    }
    const stored = selectedCommunityId;
    const valid = stored && memberships.some((m) => m.communityId === stored);
    if (valid) return;
    const fallback =
      memberships.find((m) => m.status === 'active') ?? memberships[0];
    setSelectedCommunityIdState(fallback.communityId);
    saveStoredCommunityId(fallback.communityId);
  }, [currentUser, memberships, selectedCommunityId]);

  const setSelectedCommunityId = useCallback((id: string | null) => {
    setSelectedCommunityIdState(id);
    saveStoredCommunityId(id);
  }, []);

  const selectedMembership = useMemo(
    () => memberships.find((m) => m.communityId === selectedCommunityId) ?? null,
    [memberships, selectedCommunityId],
  );

  const value = useMemo(
    () => ({
      memberships,
      selectedCommunityId,
      selectedMembership,
      loading,
      issuedParticipantScope,
      setSelectedCommunityId,
      refreshMemberships,
    }),
    [
      memberships,
      selectedCommunityId,
      selectedMembership,
      loading,
      issuedParticipantScope,
      setSelectedCommunityId,
      refreshMemberships,
    ],
  );

  return (
    <SelectedCommunityContext.Provider value={value}>
      {children}
    </SelectedCommunityContext.Provider>
  );
}
