/* Context + hook only; not a route component. */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';

export type FloatingPanelDragHandleProps = {
  onPointerDown: (e: React.PointerEvent) => void;
  style?: React.CSSProperties;
};

const FloatingPanelDragContext = createContext<FloatingPanelDragHandleProps | null>(null);

export { FloatingPanelDragContext };

/** 親の `FloatingPanelShell` 内でのみ値あり（それ以外は null） */
export function useFloatingPanelDragHandle(): FloatingPanelDragHandleProps | null {
  return useContext(FloatingPanelDragContext);
}
