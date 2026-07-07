export type MyHossiiMotionMode = 'free' | 'anchored' | 'auto';

export type MyHossiiLogVisibility = 'public' | 'authenticated' | 'hidden';

export type MyHossiiAnimationTier = 'full' | 'light' | 'none';

export type MyHossiiParticipant = {
  userId: string;
  nickname: string;
  hossiiSourceType: 'preset' | 'upload' | 'custom';
  hossiiPresetKey: string | null;
  hossiiImagePath: string | null;
  hossiiUpdatedAt: string | null;
};

export type MyHossiiDisplayState = 'default' | 'active' | 'happy' | 'thinking' | 'quiet';

export const DEFAULT_MY_HOSSII_MOTION_MODE: MyHossiiMotionMode = 'auto';

export const DEFAULT_MY_HOSSII_LOG_VISIBILITY: MyHossiiLogVisibility = 'public';
