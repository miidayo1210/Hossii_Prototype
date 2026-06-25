import { useSyncExternalStore } from 'react';
import type { Hossii } from '../types';
import {
  getHossiiEntitySnapshot,
  subscribeHossiiEntity,
} from './hossiiEntityStore';

/** id 単位で entity を購読（87 §9.1 方式 A） */
export function useHossiiEntity(id: string | null | undefined): Hossii | undefined {
  return useSyncExternalStore(
    subscribeHossiiEntity,
    () => (id ? getHossiiEntitySnapshot(id) : undefined),
    () => (id ? getHossiiEntitySnapshot(id) : undefined),
  );
}
