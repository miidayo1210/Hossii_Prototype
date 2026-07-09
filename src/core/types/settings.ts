// スペース設定の型定義

export type BottleFrequency = '1d' | '3d-7d' | '2w' | '1m' | 'off';

export type StarMarkerType = 'star' | 'circle' | 'pin' | 'person';

export const STAR_MARKER_OPTIONS: { id: StarMarkerType; label: string }[] = [
  { id: 'star', label: '星' },
  { id: 'circle', label: 'まる' },
  { id: 'pin', label: 'ピン' },
  { id: 'person', label: '人型' },
];

export const DEFAULT_STAR_MARKER: StarMarkerType = 'star';

export type SpaceFeatures = {
  /** @deprecated 正本は postFields.message。localStorage 互換用 */
  messagePost?: boolean;
  /** @deprecated 正本は postFields */
  emotionPost?: boolean;
  /** @deprecated 正本は postFields */
  photoPost?: boolean;
  /** @deprecated 正本は postFields */
  numberPost?: boolean;
  likesEnabled: boolean;
};

// バブル編集権限: 'all' = 全員可, 'owner_and_admin' = 投稿者本人と管理者のみ
export type BubbleEditPermission = 'all' | 'owner_and_admin';

export type PostingSettings = {
  positionMode: 'auto' | 'selector';
};

export type ReflectionSettings = {
  randomRecallEnabled: boolean;
};

export const DEFAULT_POSTING_SETTINGS: PostingSettings = {
  positionMode: 'auto',
};

export const DEFAULT_REFLECTION_SETTINGS: ReflectionSettings = {
  randomRecallEnabled: false,
};

export type PostFieldConfig = {
  enabled: boolean;
  required: boolean;
};

export type PostFieldSettings = {
  message: PostFieldConfig;
  emotion: PostFieldConfig;
  tags: PostFieldConfig;
  photo: PostFieldConfig;
  bubbleColor: PostFieldConfig;
  bubbleShape: PostFieldConfig;
  numberPost: PostFieldConfig;
};

export const DEFAULT_POST_FIELD_SETTINGS: PostFieldSettings = {
  message: { enabled: true, required: false },
  emotion: { enabled: true, required: false },
  tags: { enabled: true, required: false },
  photo: { enabled: true, required: false },
  bubbleColor: { enabled: true, required: false },
  bubbleShape: { enabled: true, required: false },
  numberPost: { enabled: false, required: false },
};

export type SpaceModeId = 'plaza' | 'reflection' | 'workshop' | 'event' | 'custom';

export type SpaceModeSnapshot = {
  isPrivate: boolean;
  likesEnabled: boolean;
  positionMode: 'auto' | 'selector';
  randomRecallEnabled: boolean;
  bubbleEditPermission: BubbleEditPermission;
  postFields: PostFieldSettings;
};

export type SpaceModeState = {
  appliedMode: SpaceModeId;
  isCustomized: boolean;
  appliedAt?: string;
  snapshot?: SpaceModeSnapshot;
};

export const DEFAULT_SPACE_MODE_STATE: SpaceModeState = {
  appliedMode: 'custom',
  isCustomized: false,
};

export type SpaceSettings = {
  spaceId: string;
  /** 表示用。正本は Space.name（DB には保存しない） */
  spaceName: string;
  features: SpaceFeatures;
  bubbleEditPermission: BubbleEditPermission;
  bottleFrequency: BottleFrequency;
  postFields?: PostFieldSettings;
  starMarkerType?: StarMarkerType;
  posting?: PostingSettings;
  reflection?: ReflectionSettings;
  mode?: SpaceModeState;
  /** 時系列奥行き表示 ON/OFF。未設定は OFF（108） */
  timelineDepthEnabled?: boolean;
};

export const DEFAULT_SPACE_FEATURES: SpaceFeatures = {
  likesEnabled: true,
};

export const DEFAULT_SPACE_SETTINGS: Omit<SpaceSettings, 'spaceId' | 'spaceName'> = {
  features: DEFAULT_SPACE_FEATURES,
  bubbleEditPermission: 'all',
  bottleFrequency: '3d-7d',
  postFields: DEFAULT_POST_FIELD_SETTINGS,
  posting: DEFAULT_POSTING_SETTINGS,
  reflection: DEFAULT_REFLECTION_SETTINGS,
  mode: DEFAULT_SPACE_MODE_STATE,
};
