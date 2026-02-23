/**
 * Hossii通常（待機）表情画像
 * public/hossii/idle/ 配下のPNGを参照
 *
 * 配置先: public/hossii/idle/
 * - idle_base.png
 * - idle_smile.png
 * - idle_closingeye.png
 */

const BASE_PATH = '/hossii/idle';

export const HOSSII_IDLE = {
  base: `${BASE_PATH}/idle_base.png`,
  smile: `${BASE_PATH}/idle_smile.png`,
  closingEye: `${BASE_PATH}/idle_closingeye.png`,
} as const;

export type IdleKey = keyof typeof HOSSII_IDLE;

/**
 * デフォルト待機表情を取得
 */
export function getDefaultIdle(): string {
  return HOSSII_IDLE.base;
}

/**
 * インタラクション用の笑顔系表情（2-3種からランダム）
 */
const INTERACTION_FACES = [
  HOSSII_IDLE.smile,
  HOSSII_IDLE.closingEye,
];

export function getRandomInteractionFace(): string {
  return INTERACTION_FACES[Math.floor(Math.random() * INTERACTION_FACES.length)];
}

/**
 * Listen モード用の表情（目を閉じている = 聞いている）
 */
export function getListeningFace(): string {
  return HOSSII_IDLE.closingEye;
}
