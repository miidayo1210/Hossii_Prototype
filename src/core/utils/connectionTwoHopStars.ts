export const CONNECTION_TWO_HOP_STARS_ATTR = 'data-connection-two-hop-stars';

export function applyConnectionTwoHopStars(
  element: HTMLElement,
  count: 1 | 2 | 3,
  reducedMotion = false,
): void {
  element.setAttribute(
    CONNECTION_TWO_HOP_STARS_ATTR,
    reducedMotion ? '1' : String(count),
  );
}

export function clearConnectionTwoHopStars(element: HTMLElement): void {
  element.removeAttribute(CONNECTION_TWO_HOP_STARS_ATTR);
}

export function clearConnectionTwoHopStarsFromElements(
  elements: readonly HTMLElement[],
): void {
  for (const element of elements) {
    clearConnectionTwoHopStars(element);
  }
}
