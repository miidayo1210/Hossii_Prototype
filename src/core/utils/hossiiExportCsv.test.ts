import { describe, expect, it } from 'vitest';
import {
  ADMIN_EXPORT_STANDARD_HEADERS,
  buildAdminExportCsv,
  buildAdminExportCsvHeaders,
  buildAdminExportCsvRow,
  buildAdminExportFilename,
  escapeCsvField,
  escapeCsvTextField,
  sanitizeCsvFormulaInjection,
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

describe('CSV formula injection protection', () => {
  it('prefixes dangerous leading characters with a single quote', () => {
    expect(sanitizeCsvFormulaInjection('=1+1')).toBe("'=1+1");
    expect(sanitizeCsvFormulaInjection('+1234')).toBe("'+1234");
    expect(sanitizeCsvFormulaInjection('-alert(1)')).toBe("'-alert(1)");
    expect(sanitizeCsvFormulaInjection('@SUM(A1)')).toBe("'@SUM(A1)");
  });



  it('blocks zero-width and BOM prefixed formula injection attempts', () => {
    expect(sanitizeCsvFormulaInjection('\u200B=1+1')).toBe("'\u200B=1+1");
    expect(sanitizeCsvFormulaInjection('\u200C=1+1')).toBe("'\u200C=1+1");
    expect(sanitizeCsvFormulaInjection('\u200D=1+1')).toBe("'\u200D=1+1");
    expect(sanitizeCsvFormulaInjection('\u2060=1+1')).toBe("'\u2060=1+1");
    expect(sanitizeCsvFormulaInjection('\uFEFF=1+1')).toBe("'\uFEFF=1+1");
    expect(sanitizeCsvFormulaInjection('\u200B\u200C@SUM(A1:A2)')).toBe("'\u200B\u200C@SUM(A1:A2)");
    expect(escapeCsvTextField('\u200B=1,2')).toBe('"\'\u200B=1,2"');
  });

  it('leaves Japanese text and system-like safe values unchanged', () => {
    expect(sanitizeCsvFormulaInjection('挑戦と気づき')).toBe('挑戦と気づき');
    expect(sanitizeCsvFormulaInjection('2026-07-21T10:00:00+09:00')).toBe('2026-07-21T10:00:00+09:00');
  });
  it('handles LF-prefixed and multi-space formula injection attempts', () => {
    expect(sanitizeCsvFormulaInjection('\n=1+1')).toBe("'\n=1+1");
    expect(sanitizeCsvFormulaInjection('   @SUM(A1:A2)')).toBe("'   @SUM(A1:A2)");
  });

  it('does not prefix system columns in CSV rows', () => {
    const row = buildAdminExportCsvRow({
      item: {
        ...baseItem,
        hossiiId: 'post-001',
        message: '=1+1',
        emotion: '+joy',
        hashtags: ['=tag'],
      },
      spaceName: '-Space',
      exportedAt,
      includeAuthorDisplayNames: false,
      includeImageUrls: false,
    });
    const cols = row.split(',');
    expect(cols[0]).toBe('post-001');
    expect(cols[1]).toMatch(/^2026-07-21T/);
    expect(cols[4]).toBe('guest');
    expect(cols[5]).toBe('anon-001');
    expect(cols[9]).toBe('42');
    expect(cols[11]).toBe('true');
    expect(row).toContain("'=1+1");
    expect(row).toContain("'+joy");
    expect(row).toContain("'-Space");
  });
  it('handles tab and CR prefixed formula injection attempts', () => {
    expect(sanitizeCsvFormulaInjection('\t=cmd')).toBe("'\t=cmd");
    expect(sanitizeCsvFormulaInjection('\r=cmd')).toBe("'\r=cmd");
    expect(sanitizeCsvFormulaInjection(' =cmd')).toBe("' =cmd");
  });

  it('leaves safe text unchanged', () => {
    expect(sanitizeCsvFormulaInjection('本文')).toBe('本文');
    expect(sanitizeCsvFormulaInjection('https://example.test/a.png')).toBe('https://example.test/a.png');
  });

  it('sanitizes message, display name, tags, and image URL in CSV rows', () => {
    const row = buildAdminExportCsvRow({
      item: {
        ...baseItem,
        message: '=HYPERLINK("http://evil")',
        emotion: '+joy',
        hashtags: ['=tag1', 'safe'],
        authorDisplayName: '@admin',
        imageUrl: '=IMAGE("http://evil")',
      },
      spaceName: '-Space',
      exportedAt,
      includeAuthorDisplayNames: true,
      includeImageUrls: true,
    });
    expect(row).toMatch(/'=HYPERLINK\(""http:\/\/evil""\)/);
    expect(row).toContain("'+joy");
    expect(row).toContain("'=tag1｜safe");
    expect(row).toContain("'@admin");
    expect(row).toMatch(/'=IMAGE\(""http:\/\/evil""\)/);
    expect(row).toContain("'-Space");
  });

  it('does not prefix numeric number_value or ISO8601 timestamps', () => {
    const negativeNumberItem = { ...baseItem, numberValue: -12, message: '-12 as text' };
    const row = buildAdminExportCsvRow({
      item: negativeNumberItem,
      spaceName: 'Dev Space',
      exportedAt,
      includeAuthorDisplayNames: false,
      includeImageUrls: false,
    });
    const cols = row.split(',');
    expect(cols[9]).toBe('-12');
    expect(row).toContain("'-12 as text");
    expect(row).toMatch(/2026-07-21T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/);
    expect(row).not.toMatch(/,'2026-07-21T/);
  });

  it('combines formula injection protection with RFC4180 escaping', () => {
    expect(escapeCsvTextField('=1,2')).toBe('"\'=1,2"');
    expect(escapeCsvTextField('say "=bad"')).toBe('"say ""=bad"""');
  });

  it('builds full CSV with protected formula-like content', () => {
    const csv = buildAdminExportCsv({
      items: [{ ...baseItem, message: '=1+1', hashtags: ['+tag'] }],
      spaceName: 'Dev Space',
      exportedAt,
      includeAuthorDisplayNames: false,
      includeImageUrls: false,
    });
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'+tag");
  });
});

describe('CSV export benchmark (informational)', () => {
  const exportedAt = new Date('2026-07-21T22:35:10+09:00');

  function mockItems(count: number): AdminExportHossiiItem[] {
    return Array.from({ length: count }, (_, index) => ({
      ...baseItem,
      hossiiId: `bench-h-${index}`,
      message: `ベンチマーク投稿 ${index}。`.repeat(3),
      hashtags: index % 3 === 0 ? ['挑戦', '気づき'] : ['共有'],
      anonymousId: `anon-${String(index).padStart(4, '0')}`,
    }));
  }

  it.each([100, 500, 1000, 2000])('records build/blob metrics for %i rows', (rowCount) => {
    const items = mockItems(rowCount);
    const started = performance.now();
    const csv = buildAdminExportCsv({
      items,
      spaceName: 'Dev Space',
      exportedAt,
      includeAuthorDisplayNames: false,
      includeImageUrls: false,
    });
    const buildMs = performance.now() - started;
    const blob = new Blob([csv ?? ''], { type: 'text/csv;charset=utf-8' });
    const heapMb =
      typeof process !== 'undefined' && process.memoryUsage
        ? Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 10) / 10
        : null;
    console.info(
      JSON.stringify({
        rows: rowCount,
        buildMs: Math.round(buildMs * 100) / 100,
        csvChars: csv?.length ?? 0,
        blobBytes: blob.size,
        heapUsedMb: heapMb,
      }),
    );
    expect(csv).toBeTruthy();
    expect(blob.size).toBeGreaterThan(0);
  });
});
