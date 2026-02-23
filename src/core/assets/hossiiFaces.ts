/**
 * Hossii感情表情画像マッピング
 * public/hossii/emotion/ 配下のPNGを参照
 *
 * 配置先: public/hossii/emotion/
 * - wow.png
 * - heart.png (empathy)
 * - comeup.png (inspire)
 * - humhum.png (think)
 * - cryinglaughing.png (laugh)
 * - happy.png (joy)
 * - moved.png
 * - fun.png
 */

import type { EmotionKey } from '../types';

const BASE_PATH = '/hossii/emotion';

/**
 * EmotionKey -> 画像パス のマッピング
 */
export const HOSSII_FACE_BY_EMOTION: Record<EmotionKey, string> = {
  wow: `${BASE_PATH}/wow.png`,
  empathy: `${BASE_PATH}/heart.png`,
  inspire: `${BASE_PATH}/comeup.png`,
  think: `${BASE_PATH}/humhum.png`,
  laugh: `${BASE_PATH}/cryinglaughing.png`,
  joy: `${BASE_PATH}/happy.png`,
  moved: `${BASE_PATH}/moved.png`,
  fun: `${BASE_PATH}/fun.png`,
};

/**
 * EmotionKeyから表情画像パスを取得
 */
export function getHossiiFace(emotion: EmotionKey): string {
  return HOSSII_FACE_BY_EMOTION[emotion];
}
