import type { PatternKey, SpaceBackground } from '../types/space';

/**
 * Background Presets for Space Customization
 * Provides curated color, pattern, and image options
 */

// Color Presets
export const COLOR_PRESETS: Array<{ key: string; label: string; value: string }> = [
  { key: 'sky', label: '空色', value: '#EAF4FF' },
  { key: 'forest', label: '森色', value: '#E8F5E9' },
  { key: 'sunset', label: '夕焼け', value: '#FFF3E0' },
  { key: 'lavender', label: 'ラベンダー', value: '#F3E5F5' },
  { key: 'mint', label: 'ミント', value: '#E0F2F1' },
  { key: 'peach', label: 'ピーチ', value: '#FFE0E6' },
  { key: 'cream', label: 'クリーム', value: '#FFFEF0' },
  { key: 'ocean', label: '海色', value: '#E1F5FE' },
];

// Pattern Presets
export const PATTERN_PRESETS: Array<{ key: PatternKey; label: string }> = [
  { key: 'mist', label: '霧' },
  { key: 'dots', label: 'ドット' },
  { key: 'grid', label: 'グリッド' },
  { key: 'waves', label: '波' },
  { key: 'stars', label: '星空' },
];

// Image Presets (for future use - currently no images in public/bg/)
// Uncomment when images are available
export const IMAGE_PRESETS: Array<{ key: string; label: string; value: string }> = [
  // { key: 'space1', label: 'スペース1', value: '/bg/bg-space-01.jpg' },
  // { key: 'space2', label: 'スペース2', value: '/bg/bg-space-02.jpg' },
  // { key: 'space3', label: 'スペース3', value: '/bg/bg-space-03.jpg' },
];

/**
 * Helper to create a SpaceBackground from a preset
 */
export function createBackgroundFromPreset(
  kind: 'color' | 'pattern' | 'image',
  value: string,
  source: 'preset' | 'temp' | 'cloud' = 'preset'
): SpaceBackground {
  if (kind === 'color') {
    return { kind: 'color', value };
  }
  if (kind === 'pattern') {
    return { kind: 'pattern', value: value as PatternKey };
  }
  return { kind: 'image', value, source };
}
