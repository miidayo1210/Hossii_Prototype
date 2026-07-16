import type { Space } from '../types/space';
import { setSpaceArchived } from './spaceArchiveApi';

export type BulkPersonalArchiveOperation = 'archive' | 'unarchive';

export type BulkArchiveTargetPartition = {
  /** RPC を呼ぶ対象（active→archive / archived→unarchive） */
  actionable: Space[];
  /** 既に目的状態のためスキップ */
  skippedWrongState: Space[];
};

/** 選択 ID から操作対象を分類する（重複 ID は 1 回のみ）。 */
export function partitionBulkPersonalArchiveTargets(
  visibleSpaces: Space[],
  selectedIds: ReadonlySet<string>,
  operation: BulkPersonalArchiveOperation,
): BulkArchiveTargetPartition {
  const seen = new Set<string>();
  const selected: Space[] = [];

  for (const space of visibleSpaces) {
    if (!selectedIds.has(space.id) || seen.has(space.id)) continue;
    seen.add(space.id);
    selected.push(space);
  }

  if (operation === 'archive') {
    return {
      actionable: selected.filter((s) => s.isArchived !== true),
      skippedWrongState: selected.filter((s) => s.isArchived === true),
    };
  }

  return {
    actionable: selected.filter((s) => s.isArchived === true),
    skippedWrongState: selected.filter((s) => s.isArchived !== true),
  };
}

export type BulkPersonalArchiveFailure = {
  spaceId: string;
  spaceName: string;
  message: string;
};

export type BulkPersonalArchiveResult = {
  operation: BulkPersonalArchiveOperation;
  successCount: number;
  failureCount: number;
  skippedWrongStateCount: number;
  failures: BulkPersonalArchiveFailure[];
  /** store 更新用: 成功した space の patch */
  successfulPatches: Array<{
    spaceId: string;
    patch: Pick<Space, 'isArchived' | 'archivedAt' | 'archivedBy'>;
  }>;
};

function buildConfirmMessage(
  operation: BulkPersonalArchiveOperation,
  actionableCount: number,
  skippedWrongStateCount: number,
): string {
  const lines =
    operation === 'archive'
      ? [`選択した${actionableCount}件をアーカイブしますか？`]
      : [`選択した${actionableCount}件のアーカイブを解除しますか？`];

  if (operation === 'archive') {
    lines.push('アーカイブは削除ではありません。閲覧専用になり、新しい投稿はできなくなります。');
  }

  if (skippedWrongStateCount > 0) {
    const skipLabel =
      operation === 'archive' ? 'すでにアーカイブ済み' : 'アーカイブされていない';
    lines.push(`${skippedWrongStateCount}件は${skipLabel}のため対象外です。`);
  }

  return lines.join('\n');
}

export function buildBulkPersonalArchiveConfirmMessage(
  partition: BulkArchiveTargetPartition,
  operation: BulkPersonalArchiveOperation,
): string {
  return buildConfirmMessage(operation, partition.actionable.length, partition.skippedWrongState.length);
}

export function formatBulkPersonalArchiveResultMessage(result: BulkPersonalArchiveResult): string {
  const { operation, successCount, failureCount, skippedWrongStateCount, failures } = result;
  const actionPast = operation === 'archive' ? 'アーカイブ' : 'アーカイブ解除';
  const parts: string[] = [];

  if (successCount > 0) {
    parts.push(`${successCount}件を${actionPast}しました。`);
  }
  if (failureCount > 0) {
    const failedNames = failures.map((f) => f.spaceName).slice(0, 3);
    const nameSuffix =
      failures.length > 3 ? `（他${failures.length - 3}件）` : '';
    parts.push(
      `${failureCount}件は失敗しました: ${failedNames.join('、')}${nameSuffix}`,
    );
  }
  if (skippedWrongStateCount > 0 && successCount === 0 && failureCount === 0) {
    const skipLabel =
      operation === 'archive' ? 'すでにアーカイブ済み' : 'アーカイブされていない';
    parts.push(`${skippedWrongStateCount}件は${skipLabel}のため対象外でした。`);
  }
  if (parts.length === 0) {
    return '対象となるスペースがありませんでした。';
  }
  return parts.join(' ');
}

/**
 * 個人スペースを順次アーカイブ / 解除する（既存 RPC のみ、新規 RPC なし）。
 * 1 件失敗しても残りは継続する。
 */
export async function runBulkPersonalSpaceArchive(
  spaces: Space[],
  operation: BulkPersonalArchiveOperation,
): Promise<BulkPersonalArchiveResult> {
  const archived = operation === 'archive';
  const seen = new Set<string>();
  const failures: BulkPersonalArchiveFailure[] = [];
  const successfulPatches: BulkPersonalArchiveResult['successfulPatches'] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const space of spaces) {
    if (seen.has(space.id)) continue;
    seen.add(space.id);

    const result = await setSpaceArchived(space.id, archived);
    if (result.ok) {
      successCount += 1;
      successfulPatches.push({
        spaceId: result.spaceId,
        patch: {
          isArchived: result.isArchived,
          archivedAt: result.archivedAt ? new Date(result.archivedAt) : undefined,
          archivedBy: result.archivedBy ?? undefined,
        },
      });
    } else {
      failureCount += 1;
      failures.push({
        spaceId: space.id,
        spaceName: space.name,
        message: result.message,
      });
    }
  }

  return {
    operation,
    successCount,
    failureCount,
    skippedWrongStateCount: 0,
    failures,
    successfulPatches,
  };
}

/** 表示中の全行が選択されているか（0 件のとき false）。 */
export function areAllVisiblePersonalSpacesSelected(
  visibleSpaces: Space[],
  selectedIds: ReadonlySet<string>,
): boolean {
  if (visibleSpaces.length === 0) return false;
  return visibleSpaces.every((s) => selectedIds.has(s.id));
}

/** 一部のみ選択されているか。 */
export function isPartialPersonalSpaceSelection(
  visibleSpaces: Space[],
  selectedIds: ReadonlySet<string>,
): boolean {
  if (visibleSpaces.length === 0 || selectedIds.size === 0) return false;
  const selectedVisible = visibleSpaces.filter((s) => selectedIds.has(s.id)).length;
  return selectedVisible > 0 && selectedVisible < visibleSpaces.length;
}
