import type { Space } from '../types/space';
import type { SpaceModeId, SpaceSettings } from '../types/settings';
import { DEFAULT_POSTING_SETTINGS, DEFAULT_REFLECTION_SETTINGS } from '../types/settings';
import { extractModeSnapshot } from './spaceModeCustomize';
import { mergePostFieldSettings, type PostFieldKey } from './postFieldSettings';
import { getSpaceModePreset, type SpaceModePresetPatch } from './spaceModePresets';

const FIELD_KEYS: PostFieldKey[] = [
  'message',
  'emotion',
  'tags',
  'photo',
  'bubbleColor',
  'bubbleShape',
  'numberPost',
];

export type ModeDiffLine = {
  label: string;
  before: string;
  after: string;
};

function applyPostFieldsPatch(
  current: ReturnType<typeof mergePostFieldSettings>,
  patch: SpaceModePresetPatch['postFields'],
) {
  if (!patch) return current;
  const next = { ...current };
  for (const key of FIELD_KEYS) {
    const fieldPatch = patch[key];
    if (!fieldPatch) continue;
    next[key] = {
      ...next[key],
      ...fieldPatch,
    };
    if (fieldPatch.enabled === false) {
      next[key] = { ...next[key], required: false };
    }
  }
  return next;
}

export function buildModeTarget(
  modeId: SpaceModeId,
  space: Space,
  settings: SpaceSettings,
): { space: Space; settings: SpaceSettings } {
  const preset = getSpaceModePreset(modeId);
  if (!preset) return { space, settings };

  const { patch } = preset;
  const nextSpace =
    patch.isPrivate !== undefined ? { ...space, isPrivate: patch.isPrivate } : space;

  const currentPostFields = mergePostFieldSettings(settings.postFields);
  const nextPostFields = applyPostFieldsPatch(currentPostFields, patch.postFields);

  const nextSettings: SpaceSettings = {
    ...settings,
    features: {
      ...settings.features,
      ...(patch.likesEnabled !== undefined ? { likesEnabled: patch.likesEnabled } : {}),
      messagePost: nextPostFields.message.enabled,
      emotionPost: nextPostFields.emotion.enabled,
      photoPost: nextPostFields.photo.enabled,
      numberPost: nextPostFields.numberPost.enabled,
    },
    ...(patch.bubbleEditPermission !== undefined
      ? { bubbleEditPermission: patch.bubbleEditPermission }
      : {}),
    postFields: nextPostFields,
    posting:
      patch.positionMode !== undefined
        ? { positionMode: patch.positionMode }
        : settings.posting ?? DEFAULT_POSTING_SETTINGS,
    reflection:
      patch.randomRecallEnabled !== undefined
        ? { randomRecallEnabled: patch.randomRecallEnabled }
        : settings.reflection ?? DEFAULT_REFLECTION_SETTINGS,
  };

  return { space: nextSpace, settings: nextSettings };
}

function formatPrivate(isPrivate: boolean): string {
  return isPrivate ? '非公開' : 'URL を知っている人';
}

function formatLikes(enabled: boolean): string {
  return enabled ? 'ON' : 'OFF';
}

function formatPositionMode(mode: 'auto' | 'selector'): string {
  return mode === 'selector' ? '投稿者が位置を選ぶ' : '自動で配置';
}

function formatRandomRecall(enabled: boolean): string {
  return enabled ? 'ON' : 'OFF';
}

function formatBubbleEdit(perm: 'all' | 'owner_and_admin'): string {
  return perm === 'all' ? '全員が編集可能' : '投稿者本人と管理者のみ';
}

const POST_FIELD_LABELS: Record<PostFieldKey, string> = {
  message: 'メッセージ',
  emotion: '気持ち',
  tags: 'タグ',
  photo: '写真',
  bubbleColor: 'バブル色',
  bubbleShape: 'バブル形状',
  numberPost: '数値投稿',
};

function formatPostField(config: { enabled: boolean; required: boolean }): string {
  if (!config.enabled) return 'OFF';
  return config.required ? '表示（必須）' : '表示';
}

export function buildModeDiff(
  currentSpace: Space,
  currentSettings: SpaceSettings,
  targetSpace: Space,
  targetSettings: SpaceSettings,
): ModeDiffLine[] {
  const lines: ModeDiffLine[] = [];

  const curPrivate = currentSpace.isPrivate ?? false;
  const tgtPrivate = targetSpace.isPrivate ?? false;
  if (curPrivate !== tgtPrivate) {
    lines.push({
      label: '公開範囲',
      before: formatPrivate(curPrivate),
      after: formatPrivate(tgtPrivate),
    });
  }

  if (currentSettings.features.likesEnabled !== targetSettings.features.likesEnabled) {
    lines.push({
      label: 'いいね',
      before: formatLikes(currentSettings.features.likesEnabled),
      after: formatLikes(targetSettings.features.likesEnabled),
    });
  }

  const curPos = currentSettings.posting?.positionMode ?? DEFAULT_POSTING_SETTINGS.positionMode;
  const tgtPos = targetSettings.posting?.positionMode ?? DEFAULT_POSTING_SETTINGS.positionMode;
  if (curPos !== tgtPos) {
    lines.push({
      label: '投稿位置',
      before: formatPositionMode(curPos),
      after: formatPositionMode(tgtPos),
    });
  }

  const curRecall =
    currentSettings.reflection?.randomRecallEnabled ??
    DEFAULT_REFLECTION_SETTINGS.randomRecallEnabled;
  const tgtRecall =
    targetSettings.reflection?.randomRecallEnabled ??
    DEFAULT_REFLECTION_SETTINGS.randomRecallEnabled;
  if (curRecall !== tgtRecall) {
    lines.push({
      label: '過去の投稿との出会い',
      before: formatRandomRecall(curRecall),
      after: formatRandomRecall(tgtRecall),
    });
  }

  const curEdit = currentSettings.bubbleEditPermission ?? 'all';
  const tgtEdit = targetSettings.bubbleEditPermission ?? 'all';
  if (curEdit !== tgtEdit) {
    lines.push({
      label: '投稿の編集権限',
      before: formatBubbleEdit(curEdit),
      after: formatBubbleEdit(tgtEdit),
    });
  }

  const curFields = mergePostFieldSettings(currentSettings.postFields);
  const tgtFields = mergePostFieldSettings(targetSettings.postFields);
  for (const key of FIELD_KEYS) {
    const before = formatPostField(curFields[key]);
    const after = formatPostField(tgtFields[key]);
    if (before !== after) {
      lines.push({
        label: POST_FIELD_LABELS[key],
        before,
        after,
      });
    }
  }

  return lines;
}

export function applySpaceMode(
  modeId: SpaceModeId,
  space: Space,
  settings: SpaceSettings,
): { nextSpace: Space; nextSettings: SpaceSettings } {
  const { space: nextSpace, settings: nextSettings } = buildModeTarget(modeId, space, settings);
  const snapshot = extractModeSnapshot(nextSpace, nextSettings);
  return {
    nextSpace,
    nextSettings: {
      ...nextSettings,
      mode: {
        appliedMode: modeId,
        isCustomized: false,
        appliedAt: new Date().toISOString(),
        snapshot,
      },
    },
  };
}
