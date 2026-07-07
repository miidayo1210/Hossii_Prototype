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

  it('rejects unsupported versions', () => {
    expect(
      parseMyHossiiCustomConfig({
        version: 2,
        baseKey: 'idle_base',
        parts: {},
      }),
    ).toBeNull();
  });

  it('rejects non-object payloads', () => {
    expect(parseMyHossiiCustomConfig(null)).toBeNull();
    expect(parseMyHossiiCustomConfig([])).toBeNull();
    expect(parseMyHossiiCustomConfig('bad')).toBeNull();
  });

  it('ignores unknown part keys and HTML-like values', () => {
    const parsed = parseMyHossiiCustomConfig({
      version: 1,
      baseKey: 'idle_base',
      parts: {
        eyes: '<script>alert(1)</script>',
        mouth: null,
        pattern: null,
        accessory: null,
        hair: 'evil-part',
      },
    });
    expect(parsed?.parts.eyes).toBeNull();
    expect(parsed?.parts.mouth).toBeNull();
  });

  it('rejects oversized JSON', () => {
    const huge = 'a'.repeat(5000);
    expect(
      parseMyHossiiCustomConfig({
        version: 1,
        baseKey: 'idle_base',
        parts: { eyes: huge, mouth: null, pattern: null, accessory: null },
      }),
    ).toBeNull();
  });
});
