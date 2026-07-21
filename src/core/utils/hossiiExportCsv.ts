import { buildSpaceExportFilename } from './spaceExportFilename';
import type { AdminExportHossiiItem } from './hossiiExportTypes';

export const ADMIN_EXPORT_STANDARD_HEADERS = [
  '投稿日時',
  'タブ名',
  'スペース内匿名ID',
  '本文',
  '気持ち',
  'タグ',
  '数値',
  '画像あり',
];

export const ADMIN_EXPORT_OPTIONAL_AUTHOR_HEADER = '投稿者表示名';
export const ADMIN_EXPORT_OPTIONAL_IMAGE_HEADER = '画像URL';

const TAG_SEPARATOR = '｜';

/** Leading chars that spreadsheet apps may interpret as formulas (incl. whitespace / zero-width bypass). */
export const CSV_FORMULA_INJECTION_PREFIX_RE = /^[\s\uFEFF\u200B-\u200D\u2060]*[=+\-@]/;

/** Prefix with a single quote so Excel / Google Sheets treat the cell as plain text. */
export function sanitizeCsvFormulaInjection(value: string): string {
  if (CSV_FORMULA_INJECTION_PREFIX_RE.test(value)) {
    return `'${value}`;
  }
  return value;
}

/** RFC 4180 field escaping. */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** User-provided text: formula-injection safe, then RFC 4180. */
export function escapeCsvTextField(value: string): string {
  return escapeCsvField(sanitizeCsvFormulaInjection(value));
}

export function formatIso8601(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = pad(Math.floor(abs / 60));
  const minutes = pad(abs % 60);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hours}:${minutes}`;
}

export function formatExportTags(tags: string[]): string {
  return tags.filter((tag) => tag && tag.trim().length > 0).join(TAG_SEPARATOR);
}

function formatCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return escapeCsvTextField(String(value));
}

function formatCsvIsoField(value: string): string {
  return escapeCsvField(value);
}

export function buildAdminExportCsvHeaders(options: {
  includeAuthorDisplayNames: boolean;
  includeImageUrls: boolean;
}): string[] {
  const headers = [...ADMIN_EXPORT_STANDARD_HEADERS];
  if (options.includeAuthorDisplayNames) headers.push(ADMIN_EXPORT_OPTIONAL_AUTHOR_HEADER);
  if (options.includeImageUrls) headers.push(ADMIN_EXPORT_OPTIONAL_IMAGE_HEADER);
  return headers;
}

export function buildAdminExportCsvRow(options: {
  item: AdminExportHossiiItem;
  includeAuthorDisplayNames: boolean;
  includeImageUrls: boolean;
}): string {
  const { item, includeAuthorDisplayNames, includeImageUrls } = options;
  const createdAt = formatCsvIsoField(formatIso8601(new Date(item.createdAt)));
  const cols = [
    createdAt,
    formatCsvCell(item.paneName),
    formatCsvCell(item.anonymousId),
    formatCsvCell(item.message),
    formatCsvCell(item.emotion),
    formatCsvCell(formatExportTags(item.hashtags)),
    formatCsvCell(item.numberValue),
    formatCsvCell(item.hasImage),
  ];
  if (includeAuthorDisplayNames) cols.push(formatCsvCell(item.authorDisplayName ?? ''));
  if (includeImageUrls) cols.push(formatCsvCell(item.imageUrl ?? ''));
  return cols.join(',');
}

/** Returns null when there are zero rows (no CSV should be generated). */
export function buildAdminExportCsv(options: {
  items: AdminExportHossiiItem[];
  spaceName: string;
  exportedAt: Date;
  includeAuthorDisplayNames: boolean;
  includeImageUrls: boolean;
}): string | null {
  if (options.items.length === 0) return null;

  const headers = buildAdminExportCsvHeaders(options);
  const headerLine = headers.map(escapeCsvField).join(',');
  const body = options.items.map((item) =>
    buildAdminExportCsvRow({
      item,
      includeAuthorDisplayNames: options.includeAuthorDisplayNames,
      includeImageUrls: options.includeImageUrls,
    }),
  );

  return `\uFEFF${headerLine}\r\n${body.join('\r\n')}`;
}

export function buildAdminExportFilename(
  spaceName: string,
  paneLabel: string,
  exportedAt: Date,
): string {
  const datePart = `${exportedAt.getFullYear()}-${String(exportedAt.getMonth() + 1).padStart(2, '0')}-${String(exportedAt.getDate()).padStart(2, '0')}`;
  return buildSpaceExportFilename(['hossii', spaceName, paneLabel, '全回答', datePart], 'csv');
}

/** Trigger a client-side CSV download and always revoke the object URL. */
export function downloadAdminExportCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
