import type { CustomEmotion, SpaceDecoration, SpaceDecorationType } from '../types/space';

const VALID_DECORATION_TYPES: SpaceDecorationType[] = ['bulletin_board', 'sign', 'image'];

export function normalizeDecorationType(raw: unknown): SpaceDecorationType {
  if (typeof raw === 'string' && VALID_DECORATION_TYPES.includes(raw as SpaceDecorationType)) {
    return raw as SpaceDecorationType;
  }
  return 'bulletin_board';
}

export function normalizeDecoration(raw: unknown): SpaceDecoration | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id : null;
  if (!id) return null;

  const pos = obj.position;
  if (!pos || typeof pos !== 'object') return null;
  const posObj = pos as Record<string, unknown>;
  const x = typeof posObj.x === 'number' ? posObj.x : Number(posObj.x);
  const y = typeof posObj.y === 'number' ? posObj.y : Number(posObj.y);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;

  const content = obj.content;
  if (!content || typeof content !== 'object') return null;
  const contentObj = content as Record<string, unknown>;
  const body = typeof contentObj.body === 'string' ? contentObj.body : '';
  if (!body.trim()) return null;

  const style =
    obj.style && typeof obj.style === 'object'
      ? (obj.style as SpaceDecoration['style'])
      : undefined;

  return {
    id,
    type: normalizeDecorationType(obj.type),
    position: { x, y },
    content: {
      title: typeof contentObj.title === 'string' ? contentObj.title : undefined,
      body,
    },
    imageUrl: typeof obj.imageUrl === 'string' ? obj.imageUrl : undefined,
    linkUrl: typeof obj.linkUrl === 'string' ? obj.linkUrl : undefined,
    width: typeof obj.width === 'number' ? obj.width : undefined,
    height: typeof obj.height === 'number' ? obj.height : undefined,
    rotation: typeof obj.rotation === 'number' ? obj.rotation : undefined,
    layer: typeof obj.layer === 'number' ? obj.layer : undefined,
    isVisible: typeof obj.isVisible === 'boolean' ? obj.isVisible : undefined,
    style,
  };
}

export function parseDecorationsFromJson(raw: unknown): SpaceDecoration[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeDecoration).filter((d): d is SpaceDecoration => d !== null);
}

export function parseCustomEmotionsFromJson(raw: unknown): CustomEmotion[] {
  if (!Array.isArray(raw)) return [];
  const result: CustomEmotion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.id !== 'string' || typeof obj.imageUrl !== 'string') continue;
    if (typeof obj.width !== 'number' || typeof obj.height !== 'number') continue;
    result.push({
      id: obj.id,
      label: typeof obj.label === 'string' ? obj.label : undefined,
      imageUrl: obj.imageUrl,
      width: obj.width,
      height: obj.height,
    });
  }
  return result;
}
