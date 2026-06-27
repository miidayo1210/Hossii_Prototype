import type { Hossii } from '../types';

export type PaneContext = {
  spaceId: string;
  activePaneId: string;
  defaultPaneId: string;
};

type HossiiPaneRef = Pick<Hossii, 'spaceId' | 'spacePaneId'>;

/** NULL space_pane_id belongs to the default pane. */
export function effectivePaneId(
  hossii: HossiiPaneRef,
  defaultPaneId: string,
): string {
  return hossii.spacePaneId ?? defaultPaneId;
}

export function isDefaultPane(context: PaneContext): boolean {
  return context.activePaneId === context.defaultPaneId;
}

/** Whether a hossii belongs to the active pane in context. */
export function matchesPane(hossii: HossiiPaneRef, context: PaneContext): boolean {
  if (hossii.spaceId !== context.spaceId) return false;

  const effective = effectivePaneId(hossii, context.defaultPaneId);

  if (isDefaultPane(context)) {
    return (
      hossii.spacePaneId == null || hossii.spacePaneId === context.defaultPaneId
    );
  }

  return effective === context.activePaneId;
}
