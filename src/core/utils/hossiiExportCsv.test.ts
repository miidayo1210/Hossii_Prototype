import { describe, expect, it } from 'vitest';
import {
  ADMIN_EXPORT_STANDARD_HEADERS,
  buildAdminExportCsv,
  buildAdminExportCsvHeaders,
  buildAdminExportCsvRow,
  buildAdminExportFilename,
  escapeCsvField,
  formatExportTags,
  formatIso8601,
} from './hossiiExportCsv';
import type { AdminExportHossiiItem } from './hossiiExportTypes';

const exportedAt = new Date('2026-07-21T22:35:10+09:00');

const baseItem: AdminExportHossiiItem = {
  hossiiId: 'h1',
  createdAt: '2026-07-21T10:00:00+09:00',
  paneName: 'Default',
  authorType: 'guest',
  anonymousId: 'anon-001',
  message: '本文',
  emotion: 'joy',
  hashtags: ['挑戦', '気づき'],
  numberValue: 42,
  postKind: 'bubble',
  hasImage: true,
};

describe('hossiiExportCsv', () => {
  it('keeps standard 13-column order', () => {
    expect(ADMIN_EXPORT_STANDARD_HEADERS).toEqual([
      '投稿ID',
      '投稿日時',
      'スペース名',
      'タブ名',
      '投稿者種別',
      'スペース内匿名ID',
      '本文',
      '気持ち',
      'タグ',
      '数値',
      '投稿種別',
      '画像あり',
      'エクスポート日時',
    ]);
    expect(buildAdminExportCsvHeaders({ includeAuthorDisplayNames: false, includeImageUrls: false }).length).toBe(13);
  });

  it('adds optional columns only when enabled', () => {
    expect(
      buildAdminExportCsvHeaders({ includeAuthorDisplayNames: true, includeImageUrls: true }),
    ).toEqual([...ADMIN_EXPORT_STANDARD_HEADERS, '投稿者表示名', '画像URL']);
  });

  it('prefixes UTF-8 BOM', () => {
    const csv = buildAdminExportCsv({
      items: [baseItem],
      spaceName: 'Dev Space',
      exportedAt,
      includeAuthorDisplayNames: false,
      includeImageUrls: false,
    });
    expect(csv?.startsWith('\uFEFF')).toBe(true);
  });

  it('escapes commas, quotes, and newlines', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('joins tags with full-width separator', () => {
    expect(formatExportTags(['挑戦', '次の一歩'])).toBe('挑戦｜次の一歩');
  });

  it('formats ISO8601 with timezone offset', () => {
    expect(formatIso8601(exportedAt)).toMatch(/2026-07-21T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/);
  });

  it('builds Japanese row content', () => {
    const row = buildAdminExportCsvRow({
      item: baseItem,
      spaceName: 'Dev Space',
      exportedAt,
      includeAuthorDisplayNames: false,
      includeImageUrls: false,
    });
    expect(row).toContain('本文');
    expect(row).toContain('挑戦｜気づき');
    expect(row).toContain('true');
  });

  it('omits optional columns when opt-in is OFF', () => {
    const csv = buildAdminExportCsv({
      items: [baseItem],
      spaceName: 'Dev Space',
      exportedAt,
      includeAuthorDisplayNames: false,
      includeImageUrls: false,
    });
    expect(csv).not.toContain('投稿者表示名');
    expect(csv).not.toContain('画像URL');
  });

  it('includes optional columns when opt-in is ON', () => {
    const csv = buildAdminExportCsv({
      items: [{ ...baseItem, authorDisplayName: 'Taro', imageUrl: 'https://example.test/a.png' }],
      spaceName: 'Dev Space',
      exportedAt,
      includeAuthorDisplayNames: true,
      includeImageUrls: true,
    });
    expect(csv).toContain('投稿者表示名');
    expect(csv).toContain('画像URL');
    expect(csv).toContain('Taro');
    expect(csv).toContain('https://example.test/a.png');
  });

  it('returns null for zero rows', () => {
    expect(
      buildAdminExportCsv({
        items: [],
        spaceName: 'Dev Space',
        exportedAt,
        includeAuthorDisplayNames: false,
        includeImageUrls: false,
      }),
    ).toBeNull();
  });

  it('sanitizes filename', () => {
    expect(buildAdminExportFilename('Dev/Space', '全タブ', exportedAt)).toBe(
      'hossii_Dev-Space_全タブ_全回答_2026-07-21.csv',
    );
  });
});
