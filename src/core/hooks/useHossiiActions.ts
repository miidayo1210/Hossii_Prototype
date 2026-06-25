import { createContext, useContext } from 'react';
import type { HossiiContextValue } from './HossiiStoreProvider';

/** 安定参照のアクションのみ（87 §9.1 Context 分割） */
export type HossiiActionsContextValue = Omit<HossiiContextValue, 'state' | 'spacesLoadedFromSupabase' | 'hossiiLoadedFromSupabase' | 'communitySlug'>;

export const HossiiActionsContext = createContext<HossiiActionsContextValue | null>(null);

export function useHossiiActions(): HossiiActionsContextValue {
  const ctx = useContext(HossiiActionsContext);
  if (!ctx) {
    throw new Error('useHossiiActions must be used within HossiiProvider');
  }
  return ctx;
}
