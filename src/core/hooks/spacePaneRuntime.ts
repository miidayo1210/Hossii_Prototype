import { createContext, useContext, type MutableRefObject } from 'react';

export type SpacePaneRuntime = {
  spaceId: string | null;
  activePaneId: string | null;
  defaultPaneId: string | null;
};

export const EMPTY_SPACE_PANE_RUNTIME: SpacePaneRuntime = {
  spaceId: null,
  activePaneId: null,
  defaultPaneId: null,
};

export const SpacePaneRuntimeContext =
  createContext<MutableRefObject<SpacePaneRuntime> | null>(null);

export function useSpacePaneRuntimeRef(): MutableRefObject<SpacePaneRuntime> {
  const ref = useContext(SpacePaneRuntimeContext);
  if (!ref) {
    throw new Error('useSpacePaneRuntimeRef must be used within HossiiProvider');
  }
  return ref;
}
