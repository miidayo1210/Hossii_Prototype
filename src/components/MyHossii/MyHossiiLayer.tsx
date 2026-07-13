import { useEffect, useMemo, useRef, useState } from 'react';
import type { Hossii } from '../../core/types';
import type { MyHossiiLogVisibility, MyHossiiMotionMode, MyHossiiParticipant } from '../../core/types/myHossii';
import type { ParticipantEligibility } from '../../core/utils/myHossiiAppearance';
import { shouldShowSpaceRegistrationPrompt } from '../../core/utils/myHossiiAppearance';
import type { AuthorPostGroup } from '../../core/utils/authorPostGroup';
import { useMyHossiiParticipants } from '../../core/hooks/useMyHossiiParticipants';
import { resolveMyHossiiAnimationTier } from '../../core/utils/myHossiiAnimationLevel';
import { computeMyHossiiPosition, resolveMyHossiiMotionMode } from '../../core/utils/myHossiiPosition';
import { resolveMyHossiiImage } from '../../core/utils/resolveMyHossiiImage';
import { deriveMyHossiiActivity } from '../../core/utils/myHossiiActivity';
import { resolveAuthorGroupForMyHossiiUser } from '../../core/utils/myHossiiAuthorLogs';
import {
  deriveMyHossiiDisplayState,
  getMyHossiiStateLabel,
  resolveActivityScale,
} from '../../core/utils/myHossiiExpression';
import {
  buildMyHossiiSpeechBubbleText,
  MY_HOSSII_MAX_CONCURRENT_BUBBLES,
  MY_HOSSII_SPEECH_BUBBLE_DURATION_MS,
} from '../../core/utils/myHossiiSpeechBubble';
import { MyHossiiAvatar } from './MyHossiiAvatar';
import { MyHossiiPrompt } from './MyHossiiPrompt';
import styles from './MyHossiiLayer.module.css';

type Props = {
  spaceId: string;
  enabled: boolean;
  motionMode: MyHossiiMotionMode;
  logVisibility: MyHossiiLogVisibility;
  /** 吹き出し・新着検知用（現在の Pane） */
  hossiis: Hossii[];
  /** 個人ログ集計用（スペース全体の全 Pane） */
  activityHossiis: Hossii[];
  visiblePostCount: number;
  currentUserId: string | null;
  isAuthenticatedViewer: boolean;
  hasMyHossiiRegistered: boolean;
  participantEligibility: ParticipantEligibility;
  prefersReducedMotion: boolean;
  onViewAuthorLogs: (group: AuthorPostGroup) => void;
};

type ActiveBubble = {
  userId: string;
  text: string;
  expiresAt: number;
};

export const MyHossiiLayer = ({
  spaceId,
  enabled,
  motionMode,
  logVisibility,
  hossiis,
  activityHossiis,
  visiblePostCount,
  currentUserId,
  isAuthenticatedViewer,
  hasMyHossiiRegistered,
  participantEligibility,
  prefersReducedMotion,
  onViewAuthorLogs,
}: Props) => {
  const { participants, isLoading, error } = useMyHossiiParticipants(spaceId, enabled);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeBubbles, setActiveBubbles] = useState<ActiveBubble[]>([]);
  const prevHossiiIdsRef = useRef<Set<string>>(new Set());
  const bubbleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const animationTier = resolveMyHossiiAnimationTier(participants.length);
  const resolvedMotion = resolveMyHossiiMotionMode(motionMode, {
    participantCount: participants.length,
    visiblePostCount,
    prefersReducedMotion,
  });

  const participantUserIds = useMemo(
    () => new Set(participants.map((p) => p.userId)),
    [participants],
  );

  useEffect(() => {
    if (!enabled) return;

    const currentIds = new Set(hossiis.map((h) => h.id));
    const prevIds = prevHossiiIdsRef.current;
    const pendingBubbles: ActiveBubble[] = [];

    for (const hossii of hossiis) {
      if (prevIds.has(hossii.id)) continue;
      if (!hossii.authorId || !participantUserIds.has(hossii.authorId)) continue;
      if (hossii.isHidden) continue;

      const text = buildMyHossiiSpeechBubbleText(hossii);
      const expiresAt = Date.now() + MY_HOSSII_SPEECH_BUBBLE_DURATION_MS;
      pendingBubbles.push({ userId: hossii.authorId, text, expiresAt });

      const timerKey = `${hossii.authorId}-${hossii.id}`;
      const existing = bubbleTimersRef.current.get(timerKey);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        setActiveBubbles((prev) =>
          prev.filter((b) => b.userId !== hossii.authorId || b.expiresAt > Date.now()),
        );
        bubbleTimersRef.current.delete(timerKey);
      }, MY_HOSSII_SPEECH_BUBBLE_DURATION_MS);
      bubbleTimersRef.current.set(timerKey, timer);
    }

    if (pendingBubbles.length > 0) {
      queueMicrotask(() => {
        setActiveBubbles((prev) => {
          const filtered = prev.filter((b) => b.expiresAt > Date.now());
          const next = [...filtered];
          for (const bubble of pendingBubbles) {
            if (next.length >= MY_HOSSII_MAX_CONCURRENT_BUBBLES) break;
            if (next.some((b) => b.userId === bubble.userId)) continue;
            next.push(bubble);
          }
          return next;
        });
      });
    }

    prevHossiiIdsRef.current = currentIds;
  }, [hossiis, enabled, participantUserIds]);

  useEffect(() => {
    const timers = bubbleTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const onDocClick = () => setSelectedUserId(null);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  if (!enabled) return null;
  if (error) return null;
  if (isLoading && participants.length === 0) return null;

  const showPrompt = shouldShowSpaceRegistrationPrompt({
    isAuthenticated: isAuthenticatedViewer,
    spaceMyHossiiEnabled: enabled,
    participantEligibility,
    isRegistered: hasMyHossiiRegistered,
  });

  const handleViewLogs = (userId: string, nickname: string) => {
    const group = resolveAuthorGroupForMyHossiiUser(activityHossiis, {
      userId,
      nickname,
      spaceId,
    });
    onViewAuthorLogs(group);
    setSelectedUserId(null);
  };

  return (
    <div className={styles.layer} aria-hidden={participants.length === 0 && !showPrompt}>
      {participants.map((participant, index) => (
        <AvatarItem
          key={participant.userId}
          participant={participant}
          index={index}
          spaceId={spaceId}
          activityHossiis={activityHossiis}
          animationTier={animationTier}
          resolvedMotion={resolvedMotion}
          logVisibility={logVisibility}
          isAuthenticatedViewer={isAuthenticatedViewer}
          currentUserId={currentUserId}
          selectedUserId={selectedUserId}
          activeBubbles={activeBubbles}
          onSelect={setSelectedUserId}
          onDeselect={() => setSelectedUserId(null)}
          onViewLogs={handleViewLogs}
        />
      ))}

      {showPrompt && currentUserId && (
        <MyHossiiPrompt userId={currentUserId} spaceId={spaceId} />
      )}
    </div>
  );
};

type AvatarItemProps = {
  participant: MyHossiiParticipant;
  index: number;
  spaceId: string;
  activityHossiis: Hossii[];
  animationTier: ReturnType<typeof resolveMyHossiiAnimationTier>;
  resolvedMotion: ReturnType<typeof resolveMyHossiiMotionMode>;
  logVisibility: MyHossiiLogVisibility;
  isAuthenticatedViewer: boolean;
  currentUserId: string | null;
  selectedUserId: string | null;
  activeBubbles: ActiveBubble[];
  onSelect: (userId: string) => void;
  onDeselect: () => void;
  onViewLogs: (userId: string, nickname: string) => void;
};

function AvatarItem({
  participant,
  index,
  spaceId,
  activityHossiis,
  animationTier,
  resolvedMotion,
  logVisibility,
  isAuthenticatedViewer,
  currentUserId,
  selectedUserId,
  activeBubbles,
  onSelect,
  onDeselect,
  onViewLogs,
}: AvatarItemProps) {
  const position = computeMyHossiiPosition(participant.userId, spaceId, index);
  const imageSrc = resolveMyHossiiImage(participant);
  const activity = deriveMyHossiiActivity(activityHossiis, participant.userId, {
    nickname: participant.nickname,
    spaceId,
  });
  const displayState = deriveMyHossiiDisplayState(activity);
  const stateLabel = getMyHossiiStateLabel(displayState);
  const activityScale = resolveActivityScale(activity.lastActivityAt);
  const isSelf = !!currentUserId && participant.userId === currentUserId && isAuthenticatedViewer;
  const speechBubble = activeBubbles.find((b) => b.userId === participant.userId)?.text ?? null;

  return (
    <MyHossiiAvatar
      userId={participant.userId}
      nickname={participant.nickname}
      imageSrc={imageSrc}
      position={position}
      motionMode={resolvedMotion}
      animationTier={animationTier}
      isSelf={isSelf}
      displayState={displayState}
      stateLabel={stateLabel}
      activityScale={activityScale}
      activity={activity}
      logVisibility={logVisibility}
      isAuthenticatedViewer={isAuthenticatedViewer}
      speechBubble={speechBubble}
      isSelected={selectedUserId === participant.userId}
      onSelect={onSelect}
      onDeselect={onDeselect}
      onViewLogs={onViewLogs}
    />
  );
}
