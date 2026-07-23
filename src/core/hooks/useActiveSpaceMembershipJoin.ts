import { useCallback, useEffect, useRef, useState } from 'react';
import type { Space } from '../types/space';
import {
  createMembershipJoinController,
  type ActiveSpaceMembershipStatus,
  type MembershipJoinController,
  type MembershipJoinInput,
} from '../utils/membershipJoinController';

type UseActiveSpaceMembershipJoinParams = {
  configured: boolean;
  authReady: boolean;
  uid: string | null;
  activeSpaceId: string;
  spaces: Space[];
  isGuest: boolean;
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
    const allowAutoJoin =
      activeSpace?.accessMode !== 'invite_only' && !isPersonalSpace;

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
  }, [configured, authReady, uid, activeSpaceId, spaces, isGuest, resolveNickname]);

  const retryActiveSpaceMembershipJoin = useCallback(() => {
    const input = membershipJoinInputRef.current;
    if (!input) return;
    membershipJoinRef.current?.retry(input);
  }, []);

  return { activeSpaceMembershipStatus, retryActiveSpaceMembershipJoin };
}
