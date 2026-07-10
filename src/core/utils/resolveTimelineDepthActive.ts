export type ResolveTimelineDepthActiveInput = {
  enabled: boolean;
  isMainPane: boolean;
  isStarMode: boolean;
};

/** 時系列奥行き scale を starDot に適用してよいか（108 §2.1） */
export function resolveTimelineDepthActive(input: ResolveTimelineDepthActiveInput): boolean {
  return input.enabled && input.isMainPane && input.isStarMode;
}
