/**
 * 認証エントリー（トップ・ログイン・管理者）の装飾 Hossii 用プール。
 * public/hossii/emotion/（8種＋追加）と public/hossii/motion/ からランダム表示する。
 */
import { HOSSII_FACE_BY_EMOTION } from '../../core/assets/hossiiFaces';

const EMOTION_BASE = '/hossii/emotion';

/** EmotionKey 以外で emotion フォルダにある PNG（hossiiFaces に無い分） */
const AUTH_ENTRY_EMOTION_EXTRA: string[] = [
  `${EMOTION_BASE}/burning.png`,
  `${EMOTION_BASE}/cool.png`,
  `${EMOTION_BASE}/dokidoki.png`,
  `${EMOTION_BASE}/guruguru.png`,
  `${EMOTION_BASE}/hatena.png`,
  `${EMOTION_BASE}/hooh.png`,
  `${EMOTION_BASE}/hungry.png`,
  `${EMOTION_BASE}/kirakira.png`,
  `${EMOTION_BASE}/tired.png`,
  `${EMOTION_BASE}/yeah.png`,
  `${EMOTION_BASE}/zukyun.png`,
];

const MOTION_BASE = '/hossii/motion';

const AUTH_ENTRY_MOTION: string[] = [
  `${MOTION_BASE}/asking.png`,
  `${MOTION_BASE}/cheering.png`,
  `${MOTION_BASE}/god.png`,
  `${MOTION_BASE}/kiri.png`,
  `${MOTION_BASE}/listening.png`,
  `${MOTION_BASE}/memo.png`,
  `${MOTION_BASE}/myself.png`,
  `${MOTION_BASE}/otsukare.png`,
  `${MOTION_BASE}/please.png`,
  `${MOTION_BASE}/point.png`,
  `${MOTION_BASE}/running.png`,
  `${MOTION_BASE}/training.png`,
];

const AUTH_ENTRY_HOSSII_POOL: string[] = [
  ...Object.values(HOSSII_FACE_BY_EMOTION),
  ...AUTH_ENTRY_EMOTION_EXTRA,
  ...AUTH_ENTRY_MOTION,
];

export function pickAuthEntryHossiiDecorUrl(): string {
  const i = Math.floor(Math.random() * AUTH_ENTRY_HOSSII_POOL.length);
  return AUTH_ENTRY_HOSSII_POOL[i];
}
