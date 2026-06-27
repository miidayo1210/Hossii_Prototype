import type { SpacePaneRuntime } from '../hooks/spacePaneRuntime';
import type { Hossii } from '../types';
import { matchesPane, type PaneContext } from './hossiiPaneMembership';

type HossiiPaneRef = Pick<Hossii, 'spaceId' | 'spacePaneId' | 'isHidden'>;

export type RealtimePaneTransition =
  | 'ignore'
  | 'patchOnly'
  | 'removeFromActive'
  | 'addToActive';

export function runtimeMatchesActiveSpace(
  runtime: SpacePaneRuntime,
  activeSpaceId: string,
): boolean {
  return runtime.spaceId === activeSpaceId;
}

export function canEvaluatePaneMembership(runtime: SpacePaneRuntime): boolean {
  return runtime.defaultPaneId != null;
}

export function toPaneContext(runtime: SpacePaneRuntime): PaneContext | null {
  if (
    runtime.spaceId == null ||
    runtime.activePaneId == null ||
    runtime.defaultPaneId == null
  ) {
    return null;
  }
  return {
    spaceId: runtime.spaceId,
    activePaneId: runtime.activePaneId,
    defaultPaneId: runtime.defaultPaneId,
  };
}

/** Whether hossii is visible in the active pane (hidden posts are inactive). */
function isVisibleInActivePane(
  hossii: HossiiPaneRef,
  context: PaneContext,
): boolean {
  if (hossii.isHidden) return false;
  return matchesPane(hossii, context);
}

export function wasActive(
  before: HossiiPaneRef,
  runtime: SpacePaneRuntime,
): boolean {
  const context = toPaneContext(runtime);
  if (!context) return false;
  return isVisibleInActivePane(before, context);
}

export function isActive(
  after: HossiiPaneRef,
  runtime: SpacePaneRuntime,
): boolean {
  const context = toPaneContext(runtime);
  if (!context) return false;
  return isVisibleInActivePane(after, context);
}

export function shouldAcceptRealtimeInsert(
  hossii: HossiiPaneRef,
  runtime: SpacePaneRuntime,
  activeSpaceId: string,
): boolean {
  if (!runtimeMatchesActiveSpace(runtime, activeSpaceId)) return false;
  if (!canEvaluatePaneMembership(runtime)) return false;
  return isActive(hossii, runtime);
}

export function classifyRealtimeUpdate(
  before: HossiiPaneRef,
  after: HossiiPaneRef,
  runtime: SpacePaneRuntime,
): RealtimePaneTransition {
  const beforeActive = wasActive(before, runtime);
  const afterActive = isActive(after, runtime);

  if (beforeActive && afterActive) return 'patchOnly';
  if (beforeActive && !afterActive) return 'removeFromActive';
  if (!beforeActive && afterActive) return 'addToActive';
  return 'ignore';
}
