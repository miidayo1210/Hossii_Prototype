import { describe, expect, it } from 'vitest';
import {
  createDefaultMyHossiiCustomConfig,
  parseMyHossiiCustomConfig,
} from './myHossiiCustomConfig';

describe('myHossiiCustomConfig', () => {
  it('creates default config with valid base key', () => {
    const config = createDefaultMyHossiiCustomConfig('idle_smile');
    expect(config.baseKey).toBe('idle_smile');
    expect(config.parts.eyes).toBeNull();
  });

  it('parses valid config', () => {
    const parsed = parseMyHossiiCustomConfig({
      version: 1,
      baseKey: 'idle_base',
      parts: { eyes: null, mouth: null, pattern: null, accessory: null },
    });
    expect(parsed?.baseKey).toBe('idle_base');
  });

  it('rejects unknown base keys', () => {
    expect(
      parseMyHossiiCustomConfig({
        version: 1,
        baseKey: 'invalid_key',
        parts: {},
      }),
    ).toBeNull();
  });

  it('rejects URL-like part values', () => {
    const parsed = parseMyHossiiCustomConfig({
      version: 1,
      baseKey: 'idle_base',
      parts: { eyes: 'https://evil.example', mouth: null, pattern: null, accessory: null },
    });
    expect(parsed?.parts.eyes).toBeNull();
    expect(parsed?.baseKey).toBe('idle_base');
  });
});
