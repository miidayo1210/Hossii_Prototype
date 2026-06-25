import type { PostFieldConfig, PostFieldSettings, SpaceSettings } from '../types/settings';
import { DEFAULT_POST_FIELD_SETTINGS } from '../types/settings';

export type PostFieldKey = keyof PostFieldSettings;

const FIELD_KEYS: PostFieldKey[] = [
  'message',
  'emotion',
  'tags',
  'photo',
  'bubbleColor',
  'bubbleShape',
  'numberPost',
];

function parseFieldConfig(raw: unknown, fallback: PostFieldConfig): PostFieldConfig {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const obj = raw as Record<string, unknown>;
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : fallback.enabled,
    required: typeof obj.required === 'boolean' ? obj.required : fallback.required,
  };
}

export function mergePostFieldSettings(partial: Partial<PostFieldSettings> | undefined): PostFieldSettings {
  const result = { ...DEFAULT_POST_FIELD_SETTINGS };
  if (!partial) return result;

  for (const key of FIELD_KEYS) {
    result[key] = parseFieldConfig(partial[key], DEFAULT_POST_FIELD_SETTINGS[key]);
    if (!result[key].enabled) {
      result[key] = { ...result[key], required: false };
    }
  }
  return result;
}

export function resolvePostFields(settings: SpaceSettings | null | undefined): PostFieldSettings {
  if (!settings) return { ...DEFAULT_POST_FIELD_SETTINGS };

  if (settings.postFields) {
    return mergePostFieldSettings(settings.postFields);
  }

  const f = settings.features;
  return mergePostFieldSettings({
    message: { enabled: f.messagePost ?? true, required: false },
    emotion: { enabled: f.emotionPost ?? true, required: false },
    tags: { enabled: true, required: false },
    photo: { enabled: f.photoPost ?? true, required: false },
    bubbleColor: { enabled: true, required: false },
    bubbleShape: { enabled: true, required: false },
    numberPost: { enabled: f.numberPost ?? false, required: false },
  });
}

export function applyPostFieldChange(
  settings: SpaceSettings,
  field: PostFieldKey,
  key: 'enabled' | 'required',
  value: boolean,
): SpaceSettings {
  const current = mergePostFieldSettings(settings.postFields);
  const nextField: PostFieldConfig = { ...current[field], [key]: value };
  if (key === 'enabled' && !value) {
    nextField.required = false;
  }
  return {
    ...settings,
    postFields: {
      ...current,
      [field]: nextField,
    },
  };
}

export function allPostFieldsDisabled(pf: PostFieldSettings): boolean {
  return FIELD_KEYS.every((k) => !pf[k].enabled);
}

export function postFieldsToJson(pf: PostFieldSettings): Record<string, PostFieldConfig> {
  return { ...pf };
}

export function parsePostFieldsFromJson(raw: unknown): PostFieldSettings | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  return mergePostFieldSettings(raw as Partial<PostFieldSettings>);
}
