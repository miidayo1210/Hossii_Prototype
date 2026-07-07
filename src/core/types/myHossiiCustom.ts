export type MyHossiiCustomPartKey = 'eyes' | 'mouth' | 'pattern' | 'accessory';

export type MyHossiiCustomParts = Record<MyHossiiCustomPartKey, string | null>;

export type MyHossiiCustomConfig = {
  version: 1;
  baseKey: string;
  parts: MyHossiiCustomParts;
};

export const MY_HOSSII_CUSTOM_CONFIG_VERSION = 1 as const;

export const MY_HOSSII_CUSTOM_MAX_BYTES = 4096;

export const EMPTY_MY_HOSSII_CUSTOM_PARTS: MyHossiiCustomParts = {
  eyes: null,
  mouth: null,
  pattern: null,
  accessory: null,
};

export const MY_HOSSII_CUSTOM_BASE_KEYS = ['idle_base', 'idle_smile', 'idle_closingeye'] as const;

export type MyHossiiCustomBaseKey = (typeof MY_HOSSII_CUSTOM_BASE_KEYS)[number];
