const INVALID_CHARS = /[/\\?%*:|"<>]/g;

/** 書き出しファイル名用（連結してサニタイズ、長さ上限） */
export function buildSpaceExportFilename(parts: string[], ext: string): string {
  const raw = parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join('_')
    .replace(INVALID_CHARS, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const base = raw.length > 0 ? raw.slice(0, 160) : 'space-export';
  const e = ext.startsWith('.') ? ext : `.${ext}`;
  return `${base}${e}`;
}
