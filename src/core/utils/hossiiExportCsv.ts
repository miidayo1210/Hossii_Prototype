import { buildSpaceExportFilename } from './spaceExportFilename';
import type { AdminExportHossiiItem } from './hossiiExportTypes';

export const ADMIN_EXPORT_STANDARD_HEADERS = [
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
];

export const ADMIN_EXPORT_OPTIONAL_AUTHOR_HEADER = '投稿者表示名';
export const ADMIN_EXPORT_OPTIONAL_IMAGE_HEADER = '画像URL';

const TAG_SEPARATOR = '｜';

/** RFC 4180 field escaping. */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
  return escapeCsvField(String(value));
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
  spaceName: string;
  exportedAt: Date;
  includeAuthorDisplayNames: boolean;
  includeImageUrls: boolean;
}): string {
  const { item, spaceName, exportedAt, includeAuthorDisplayNames, includeImageUrls } = options;
  const cols: Array<string | number | boolean | null | undefined> = [
    item.hossiiId,
    formatIso8601(new Date(item.createdAt)),
    spaceName,
    item.paneName,
    item.authorType,
    item.anonymousId,
    item.message,
    item.emotion,
    formatExportTags(item.hashtags),
    item.numberValue,
    item.postKind,
    item.hasImage,
    formatIso8601(exportedAt),
  ];
  if (includeAuthorDisplayNames) cols.push(item.authorDisplayName ?? '');
  if (includeImageUrls) cols.push(item.imageUrl ?? '');
  return cols.map(formatCsvCell).join(',');
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
      spaceName: options.spaceName,
      exportedAt: options.exportedAt,
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

export function downloadAdminExportCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
