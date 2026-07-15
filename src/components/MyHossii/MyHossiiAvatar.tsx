import styles from './MyHossiiAvatar.module.css';
import type { MyHossiiAnimationTier } from '../../core/types/myHossii';
import type { ResolvedMotionMode } from '../../core/utils/myHossiiPosition';
import type { MyHossiiDisplayState } from '../../core/types/myHossii';
import type { MyHossiiActivity } from '../../core/utils/myHossiiActivity';
import type { MyHossiiLogVisibility } from '../../core/types/myHossii';
import { shouldShowMyHossiiLogButton } from '../../core/utils/myHossiiAppearance';
import { MyHossiiPopover } from './MyHossiiPopover';

export type MyHossiiAvatarProps = {
  userId: string;
  nickname: string;
  imageSrc: string;
  position: { x: number; y: number };
  motionMode: ResolvedMotionMode;
  animationTier: MyHossiiAnimationTier;
  isSelf: boolean;
  displayState: MyHossiiDisplayState;
  stateLabel: string;
  activityScale: number;
  activity: MyHossiiActivity;
  /** 本人の DB 集計を取得中（popover で「集計中」を表示）。 */
  activityLoading?: boolean;
  logVisibility: MyHossiiLogVisibility;
  isAuthenticatedViewer: boolean;
  speechBubble: string | null;
  isSelected: boolean;
  onSelect: (userId: string) => void;
  onDeselect: () => void;
  onViewLogs: (userId: string, nickname: string) => void;
};

export const MyHossiiAvatar = ({
  userId,
  nickname,
  imageSrc,
  position,
  motionMode,
  animationTier,
  isSelf,
  displayState,
  stateLabel,
  activityScale,
  activity,
  activityLoading = false,
  logVisibility,
  isAuthenticatedViewer,
  speechBubble,
  isSelected,
  onSelect,
  onDeselect,
  onViewLogs,
}: MyHossiiAvatarProps) => {
  const showLogs = shouldShowMyHossiiLogButton(logVisibility, isAuthenticatedViewer);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelected) {
      onDeselect();
    } else {
      onSelect(userId);
    }
  };

  const motionClass =
    animationTier === 'none' || motionMode === 'static'
      ? styles.motionStatic
      : motionMode === 'anchored'
        ? styles.motionAnchored
        : styles.motionFree;

  const tierClass =
    animationTier === 'light' ? styles.tierLight : animationTier === 'none' ? styles.tierNone : '';

  return (
    <div
      className={`${styles.avatarRoot} ${motionClass} ${tierClass} ${isSelf ? styles.isSelf : ''} ${isSelected ? styles.isSelected : ''}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        '--activity-scale': activityScale,
      } as React.CSSProperties}
      data-display-state={displayState}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${nickname}のマイHossii`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
    >
      <div className={styles.avatarGlow} aria-hidden />
      <img src={imageSrc} alt="" className={styles.avatarImage} draggable={false} />

      {speechBubble && (
        <div className={styles.speechBubble} role="status">
          {speechBubble}
        </div>
      )}

      {isSelected && (
        <MyHossiiPopover
          nickname={nickname}
          stateLabel={stateLabel}
          activity={activity}
          showLogs={showLogs}
          isSelf={isSelf}
          activityLoading={activityLoading}
          onViewLogs={() => onViewLogs(userId, nickname)}
          onClose={onDeselect}
        />
      )}
    </div>
  );
};
