import { useCallback, useEffect, useRef, useState } from 'react';
import type { Space } from '../types/space';
import {
  createMembershipJoinController,
  type ActiveSpaceMembershipStatus,
  type MembershipJoinController,
  type MembershipJoinInput,
} from '../utils/membershipJoinController';
import { shouldAutoJoinSpace } from '../utils/participantAutoJoinGate';
import type { IssuedParticipantScopeResult } from '../utils/participantAccountScopeApi';

type UseActiveSpaceMembershipJoinParams = {
  configured: boolean;
  authReady: boolean;
  uid: string | null;
  activeSpaceId: string;
  spaces: Space[];
  isGuest: boolean;
  /** 参加IDのみ true。通常アカウント・ゲストは false */
  isIssuedParticipant: boolean;
  /** SelectedCommunityProvider 取得済み scope（二重 RPC 禁止） */
  issuedParticipantScope: IssuedParticipantScopeResult | null;
  affiliationLoading: boolean;
  resolveNickname: () => string | null;
  join: (spaceId: string, nickname: string | null) => Promise<unknown>;
};

export function useActiveSpaceMembershipJoin({
  configured,
  authReady,
  uid,
  activeSpaceId,
  spaces,
  isGuest,
  isIssuedParticipant,
  issuedParticipantScope,
  affiliationLoading,
  resolveNickname,
  join,
}: UseActiveSpaceMembershipJoinParams) {
  const [activeSpaceMembershipStatus, setActiveSpaceMembershipStatus] =
    useState<ActiveSpaceMembershipStatus>('idle');
  const membershipJoinRef = useRef<MembershipJoinController | null>(null);
  const membershipJoinInputRef = useRef<MembershipJoinInput | null>(null);

  if (membershipJoinRef.current === null) {
    membershipJoinRef.current = createMembershipJoinController({
      join,
      onError: () => {
        console.error('[HossiiStore] failed to register space membership');
      },
      onStatusChange: setActiveSpaceMembershipStatus,
    });
  }

  useEffect(() => {
    const activeSpace = spaces.find((s) => s.id === activeSpaceId);
    const isPersonalSpace = activeSpace?.spaceType === 'personal';
    const baseAllowAutoJoin =
      activeSpace?.accessMode !== 'invite_only' && !isPersonalSpace;
    const allowAutoJoin = shouldAutoJoinSpace({
      baseAllowAutoJoin,
      isIssuedParticipant,
      activeSpaceId: activeSpaceId || null,
      affiliationLoading,
      issuedParticipantScope,
    });

    const membershipInput: MembershipJoinInput = {
      configured,
      authReady,
      uid,
      spaceId: activeSpaceId || null,
      isGuest,
      allowAutoJoin,
      resolveNickname,
    };
    membershipJoinInputRef.current = membershipInput;
    membershipJoinRef.current?.sync(membershipInput);
  }, [
    configured,
    authReady,
    uid,
    activeSpaceId,
    spaces,
    isGuest,
    isIssuedParticipant,
    issuedParticipantScope,
    affiliationLoading,
    resolveNickname,
  ]);

  const retryActiveSpaceMembershipJoin = useCallback(() => {
    const input = membershipJoinInputRef.current;
    if (!input) return;
    membershipJoinRef.current?.retry(input);
  }, []);

  return { activeSpaceMembershipStatus, retryActiveSpaceMembershipJoin };
}
