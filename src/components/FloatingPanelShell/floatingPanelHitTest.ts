/** パネル移動の開始に使ってよいか（リサイズハンドル・ボタン・入力・data-no-drag 以外） */
export function shouldStartPanelDrag(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('[data-floating-resize]')) return false;
  return !target.closest(
    [
      'button',
      'a',
      'input',
      'textarea',
      'select',
      'option',
      'label',
      '[role="button"]',
      '[role="checkbox"]',
      '[role="switch"]',
      '[role="menuitem"]',
      '[data-no-drag]',
      '[contenteditable="true"]',
    ].join(',')
  );
}
