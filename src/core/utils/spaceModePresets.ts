import type { BubbleEditPermission, PostFieldConfig, SpaceModeId } from '../types/settings';
import type { PostFieldKey } from './postFieldSettings';

export type SpaceModePresetPatch = {
  isPrivate?: boolean;
  likesEnabled?: boolean;
  positionMode?: 'auto' | 'selector';
  randomRecallEnabled?: boolean;
  bubbleEditPermission?: BubbleEditPermission;
  postFields?: Partial<Record<PostFieldKey, Partial<PostFieldConfig>>>;
};

export type SpaceModePreset = {
  id: Exclude<SpaceModeId, 'custom'>;
  label: string;
  description: string;
  patch: SpaceModePresetPatch;
};

export const SPACE_MODE_PRESETS: SpaceModePreset[] = [
  {
    id: 'plaza',
    label: '自由な広場',
    description: 'オープンな交流。来訪者が気軽に書き込める掲示板型',
    patch: {
      isPrivate: false,
      likesEnabled: true,
      positionMode: 'selector',
      randomRecallEnabled: false,
      bubbleEditPermission: 'all',
      postFields: {
        tags: { enabled: true },
        photo: { enabled: true },
      },
    },
  },
  {
    id: 'reflection',
    label: '内省・振り返り',
    description: '個人の記録と振り返り。非公開で静かに蓄積',
    patch: {
      isPrivate: true,
      likesEnabled: false,
      positionMode: 'auto',
      randomRecallEnabled: true,
      bubbleEditPermission: 'owner_and_admin',
      postFields: {
        message: { enabled: true },
        emotion: { enabled: true },
        tags: { enabled: true },
      },
    },
  },
  {
    id: 'workshop',
    label: 'ワークショップ',
    description: 'セッション型。メッセージ必須で参加者の声を集める',
    patch: {
      likesEnabled: true,
      positionMode: 'selector',
      postFields: {
        message: { enabled: true, required: true },
        tags: { enabled: true },
        photo: { enabled: true },
        numberPost: { enabled: true },
      },
    },
  },
  {
    id: 'event',
    label: 'イベント',
    description: '短期イベント。気持ちとタグ中心の参加体験',
    patch: {
      isPrivate: false,
      likesEnabled: true,
      positionMode: 'auto',
      postFields: {
        emotion: { enabled: true },
        tags: { enabled: true },
        message: { enabled: true, required: false },
      },
    },
  },
];

export function getSpaceModePreset(modeId: SpaceModeId): SpaceModePreset | undefined {
  if (modeId === 'custom') return undefined;
  return SPACE_MODE_PRESETS.find((p) => p.id === modeId);
}

export function getSpaceModeLabel(modeId: SpaceModeId): string {
  if (modeId === 'custom') return 'カスタム';
  return getSpaceModePreset(modeId)?.label ?? modeId;
}
