/** data-attribute セレクタ用の最小エスケープ（jsdom 等 CSS.escape 非対応環境向け） */
export function escapeDataAttributeSelectorValue(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
