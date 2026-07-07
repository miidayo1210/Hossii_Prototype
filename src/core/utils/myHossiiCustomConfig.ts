import { isValidHossiiPresetKey } from '../assets/hossiiPresets';
import {
  EMPTY_MY_HOSSII_CUSTOM_PARTS,
  MY_HOSSII_CUSTOM_BASE_KEYS,
  MY_HOSSII_CUSTOM_CONFIG_VERSION,
  MY_HOSSII_CUSTOM_MAX_BYTES,
  type MyHossiiCustomConfig,
  type MyHossiiCustomPartKey,
} from '../types/myHossiiCustom';

const PART_KEYS: MyHossiiCustomPartKey[] = ['eyes', 'mouth', 'pattern', 'accessory'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePartValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 64) return null;
  if (/[<>"'`]/.test(trimmed)) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return null;
  return trimmed;
}

export function createDefaultMyHossiiCustomConfig(
  baseKey: string = 'idle_base',
): MyHossiiCustomConfig {
  const safeBase = isValidHossiiPresetKey(baseKey) ? baseKey : 'idle_base';
  return {
    version: MY_HOSSII_CUSTOM_CONFIG_VERSION,
    baseKey: safeBase,
    parts: { ...EMPTY_MY_HOSSII_CUSTOM_PARTS },
  };
}

export function parseMyHossiiCustomConfig(raw: unknown): MyHossiiCustomConfig | null {
  if (!isPlainObject(raw)) return null;
  if (JSON.stringify(raw).length > MY_HOSSII_CUSTOM_MAX_BYTES) return null;
  if (raw.version !== MY_HOSSII_CUSTOM_CONFIG_VERSION) return null;

  const baseKey = typeof raw.baseKey === 'string' ? raw.baseKey.trim() : '';
  if (!isValidHossiiPresetKey(baseKey)) return null;
  if (!(MY_HOSSII_CUSTOM_BASE_KEYS as readonly string[]).includes(baseKey)) return null;

  const partsInput = isPlainObject(raw.parts) ? raw.parts : {};
  const parts = { ...EMPTY_MY_HOSSII_CUSTOM_PARTS };
  for (const key of PART_KEYS) {
    parts[key] = parsePartValue(partsInput[key]);
  }

  const config: MyHossiiCustomConfig = {
    version: MY_HOSSII_CUSTOM_CONFIG_VERSION,
    baseKey,
    parts,
  };

  if (JSON.stringify(config).length > MY_HOSSII_CUSTOM_MAX_BYTES) return null;
  return config;
}

export function isMyHossiiCustomConfigComplete(config: MyHossiiCustomConfig): boolean {
  return isValidHossiiPresetKey(config.baseKey);
}

/** @internal テスト用 */
export function sanitizeCustomConfigForTest(config: MyHossiiCustomConfig): MyHossiiCustomConfig {
  return parseMyHossiiCustomConfig(config) ?? createDefaultMyHossiiCustomConfig();
}
