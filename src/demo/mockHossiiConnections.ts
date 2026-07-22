import type { HossiiConnection, HossiiConnectionStrength } from '../core/types/hossiiConnection';

const DEV_MOCK_STRENGTHS: HossiiConnectionStrength[] = ['soft', 'medium', 'strong'];

function isDevMockEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.MODE !== 'test';
}

/**
 * 開発用ローカル mock 糸。
 * Production build（import.meta.env.PROD）では常に空配列。
 */
export function buildDevMockHossiiConnections(
  spaceId: string,
  paneId: string,
  hossiiIds: readonly string[],
): HossiiConnection[] {
  if (!isDevMockEnabled() || hossiiIds.length < 2) return [];

  const connections: HossiiConnection[] = [];
  const limit = Math.min(hossiiIds.length, 6);

  for (let i = 0; i < limit - 1; i += 1) {
    const sourceHossiiId = hossiiIds[i]!;
    const targetHossiiId = hossiiIds[i + 1]!;
    connections.push({
      id: `dev-mock-conn-${sourceHossiiId}-${targetHossiiId}`,
      spaceId,
      paneId,
      sourceHossiiId,
      targetHossiiId,
      strength: DEV_MOCK_STRENGTHS[i % DEV_MOCK_STRENGTHS.length]!,
    });
  }

  // 分岐用: 先頭 Hossii から 3 件目へ medium 糸（1 階層テスト用）
  if (limit >= 3) {
    connections.push({
      id: `dev-mock-conn-${hossiiIds[0]}-${hossiiIds[2]}`,
      spaceId,
      paneId,
      sourceHossiiId: hossiiIds[0]!,
      targetHossiiId: hossiiIds[2]!,
      strength: 'medium',
    });
  }

  return connections;
}

/** テスト・Story 用: gate をバイパスして mock を生成 */
export function buildMockHossiiConnectionsForTest(
  spaceId: string,
  paneId: string,
  hossiiIds: readonly string[],
): HossiiConnection[] {
  if (hossiiIds.length < 2) return [];
  return buildDevMockHossiiConnections(spaceId, paneId, hossiiIds);
}

export { isDevMockEnabled };
