import type { SpacePane } from '../../core/types/spacePane';
import { effectivePaneId } from '../../core/utils/hossiiPaneMembership';
import styles from './CommentsScreen.module.css';

type Props = {
  hossiiId: string;
  spaceId: string;
  spacePaneId: string | null | undefined;
  defaultPaneId: string;
  visiblePanes: SpacePane[];
  onMove: (hossiiId: string, targetPaneId: string) => void;
  disabled?: boolean;
};

export function MoveHossiiPaneSelect({
  hossiiId,
  spaceId,
  spacePaneId,
  defaultPaneId,
  visiblePanes,
  onMove,
  disabled = false,
}: Props) {
  const currentPaneId = effectivePaneId(
    { spaceId, spacePaneId },
    defaultPaneId,
  );

  const otherPanes = visiblePanes.filter((p) => p.id !== currentPaneId);
  if (otherPanes.length === 0) return null;

  return (
    <label className={styles.movePaneSelectWrap}>
      <span className={styles.movePaneSelectLabel}>タブへ</span>
      <select
        className={styles.movePaneSelect}
        value=""
        disabled={disabled}
        aria-label="投稿を移動するタブ"
        onChange={(e) => {
          const targetId = e.target.value;
          if (!targetId) return;
          onMove(hossiiId, targetId);
          e.target.value = '';
        }}
      >
        <option value="">選択…</option>
        {otherPanes.map((pane) => (
          <option key={pane.id} value={pane.id}>
            {pane.name}
          </option>
        ))}
      </select>
    </label>
  );
}
