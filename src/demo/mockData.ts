import type { Hossii } from '../core/types';
import { DEFAULT_SPACE_ID } from '../core/types/space';

export const mockHossiis: Hossii[] = [
  {
    id: 'mock-1',
    message: '今日はなんだか穏やかな気持ち',
    emotion: 'joy',
    spaceId: DEFAULT_SPACE_ID,
    createdAt: new Date('2024-01-15T10:30:00'),
  },
  {
    id: 'mock-2',
    message: '新しいことを始めたくてワクワクしている',
    emotion: 'inspire',
    spaceId: DEFAULT_SPACE_ID,
    createdAt: new Date('2024-01-15T11:00:00'),
  },
  {
    id: 'mock-3',
    message: '少し疲れたけど、充実感がある',
    spaceId: DEFAULT_SPACE_ID,
    createdAt: new Date('2024-01-15T14:20:00'),
  },
  {
    id: 'mock-4',
    message: '誰かと話したい気分',
    emotion: 'think',
    spaceId: DEFAULT_SPACE_ID,
    createdAt: new Date('2024-01-15T16:45:00'),
  },
  {
    id: 'mock-5',
    message: '静かに過ごしたい',
    spaceId: DEFAULT_SPACE_ID,
    createdAt: new Date('2024-01-15T19:00:00'),
  },
];
