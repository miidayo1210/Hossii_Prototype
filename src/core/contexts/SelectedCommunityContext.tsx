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
import { scopedStorageKey } from '../utils/storageScope';
import { SelectedCommunityContext } from './useSelectedCommunity';

const STORAGE_KEY = scopedStorageKey('hossii.selectedCommunityId');

function loadStoredCommunityId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveStoredCommunityId(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function SelectedCommunityProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [memberships, setMemberships] = useState<MyCommunityMembership[]>([]);
  const [selectedCommunityId, setSelectedCommunityIdState] = useState<string | null>(
    () => loadStoredCommunityId(),
  );
  const [loading, setLoading] = useState(false);

  const refreshMemberships = useCallback(async () => {
    if (!currentUser) {
      setMemberships([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchMyCommunityMemberships();
      setMemberships(rows);
    } catch (error) {
      console.error('[SelectedCommunity] fetch failed:', error);
      setMemberships([]);
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
      setSelectedCommunityId,
      refreshMemberships,
    }),
    [memberships, selectedCommunityId, selectedMembership, loading, setSelectedCommunityId, refreshMemberships],
  );

  return (
    <SelectedCommunityContext.Provider value={value}>
      {children}
    </SelectedCommunityContext.Provider>
  );
}
