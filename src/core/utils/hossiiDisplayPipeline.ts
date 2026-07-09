import type { Hossii } from '../types';
import { sortHossiisNewestFirst } from './hossiiFetchPage';
import { coerceIsHidden } from './hossiisApi';
import {
  getPeriodCutoff,
  type DisplayLimit,
  type DisplayPeriod,
  type ViewMode,
} from './displayPrefsStorage';

export type DisplayPipelineParams = {
  hossiis: Hossii[];
  displayPeriod: DisplayPeriod;
  displayLimit: DisplayLimit;
  viewMode: ViewMode;
  activeTagFilter: string | null;
};

export type DisplayPipelineResult = {
  displayHossiis: Hossii[];
  filteredHossiis: Hossii[];
  displayIds: string[];
  filteredIds: string[];
  tagCounts: Map<string, number>;
};

/** orderedIds → visible → display (slice) → tag filter */
export function runDisplayPipeline(params: DisplayPipelineParams): DisplayPipelineResult {
  const { hossiis, displayPeriod, displayLimit, viewMode, activeTagFilter } = params;
  const cutoff = getPeriodCutoff(displayPeriod);
  const limit = displayLimit === 'unlimited' ? Infinity : displayLimit;

  const visible = hossiis.filter((h) => {
    if (coerceIsHidden(h.isHidden)) return false;
    if (cutoff && h.createdAt < cutoff) return false;
    if (viewMode === 'image' && !h.imageUrl) return false;
    return true;
  });

  const sorted = sortHossiisNewestFirst(visible);
  const displayHossiis = sorted.slice(0, limit);
  const displayIds = displayHossiis.map((h) => h.id);

  const filteredHossiis = activeTagFilter
    ? displayHossiis.filter((h) => {
        const combined = [...(h.tags ?? []), ...(h.hashtags ?? [])];
        return combined.includes(activeTagFilter);
      })
    : displayHossiis;
  const filteredIds = filteredHossiis.map((h) => h.id);

  const tagCounts = new Map<string, number>();
  for (const h of displayHossiis) {
    for (const t of [...(h.tags ?? []), ...(h.hashtags ?? [])]) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }

  return { displayHossiis, filteredHossiis, displayIds, filteredIds, tagCounts };
}
