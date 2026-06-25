import type { Hossii } from '../types';

type EntityListener = () => void;

let entitiesById: Record<string, Hossii> = {};
const listeners = new Set<EntityListener>();

export function setHossiiEntitiesSnapshot(next: Record<string, Hossii>): void {
  entitiesById = next;
  listeners.forEach((l) => l());
}

export function subscribeHossiiEntity(listener: EntityListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getHossiiEntitySnapshot(id: string): Hossii | undefined {
  return entitiesById[id];
}
