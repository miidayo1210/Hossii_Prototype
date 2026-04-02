import { useState, useEffect, useMemo } from 'react';
import { Trash2, Plus } from 'lucide-react';
import type { SpaceSettings, BottleFrequency } from '../../core/types/settings';
import type { Space } from '../../core/types/space';
import { fetchNeighbors, addNeighbor, removeNeighbor } from '../../core/utils/neighborsApi';
import { fetchSpaceByUrl } from '../../core/utils/spacesApi';
import { upsertSpaceSettings } from '../../core/utils/spaceSettingsApi';
import styles from './NeighborsTab.module.css';

type Props = {
  settings: SpaceSettings;
  onUpdate: (settings: SpaceSettings) => void;
  spaceId: string;
  communitySpaces?: Space[];
};

const FREQUENCY_OPTIONS: { value: BottleFrequency; label: string }[] = [
  { value: '1d', label: '毎日' },
  { value: '3d-7d', label: '3日〜7日' },
  { value: '2w', label: '2週間' },
  { value: '1m', label: '1ヶ月' },
  { value: 'off', label: '無効' },
];

export const NeighborsTab = ({ settings, onUpdate, spaceId, communitySpaces }: Props) => {
  const [neighbors, setNeighbors] = useState<Space[]>([]);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [urlInput, setUrlInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchNeighbors(spaceId).then(setNeighbors);
  }, [spaceId]);

  // 同じコミュニティのスペースのうち、自スペースと登録済み隣人を除いた候補
  const candidates = useMemo(
    () => (communitySpaces ?? []).filter(
      (s) => s.id !== spaceId && !neighbors.some((n) => n.id === s.id),
    ),
    [communitySpaces, spaceId, neighbors],
  );

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setSuccessMsg('');
      setTimeout(() => setErrorMsg(''), 3000);
    } else {
      setSuccessMsg(msg);
      setErrorMsg('');
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  const handleFrequencyChange = async (freq: BottleFrequency) => {
    const updated = { ...settings, bottleFrequency: freq };
    onUpdate(updated);
    await upsertSpaceSettings(updated);
  };

  const handleAddNeighbor = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    setIsAdding(true);
    setErrorMsg('');

    try {
      const found = await fetchSpaceByUrl(trimmed);
      if (!found) {
        showToast('このスペースは見つかりません', true);
        return;
      }
      if (found.id === spaceId) {
        showToast('自分のスペースは登録できません', true);
        return;
      }
      if (neighbors.some((n) => n.id === found.id)) {
        showToast('すでに登録されています', true);
        return;
      }

      await addNeighbor(spaceId, found.id);
      setNeighbors((prev) => [...prev, found]);
      setUrlInput('');
      showToast('追加しました');
    } catch {
      showToast('追加に失敗しました', true);
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddCandidate = async (candidate: Space) => {
    setAddingIds((prev) => new Set(prev).add(candidate.id));
    try {
      await addNeighbor(spaceId, candidate.id);
      setNeighbors((prev) => [...prev, candidate]);
      showToast(`${candidate.name} を追加しました`);
    } catch {
      showToast('追加に失敗しました', true);
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(candidate.id);
        return next;
      });
    }
  };

  const handleRemoveNeighbor = async (neighborId: string) => {
    try {
      await removeNeighbor(spaceId, neighborId);
      setNeighbors((prev) => prev.filter((n) => n.id !== neighborId));
      showToast('削除しました');
    } catch {
      showToast('削除に失敗しました', true);
    }
  };

  return (
    <div className={styles.container}>
      {errorMsg && <div className={styles.toastError}>{errorMsg}</div>}
      {successMsg && <div className={styles.toastSuccess}>{successMsg}</div>}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>漂着メッセージの頻度</h2>
        <p className={styles.description}>隣のスペースから投稿がボトルに入って届く間隔を設定します。</p>
        <div className={styles.frequencyGroup}>
          {FREQUENCY_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              className={`${styles.freqButton} ${settings.bottleFrequency === value ? styles.freqActive : ''}`}
              onClick={() => handleFrequencyChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {candidates.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>同じコミュニティのスペース</h2>
          <p className={styles.description}>同じコミュニティに属するスペースです。ボタンを押すだけで隣のスペースとして登録できます（相互登録）。</p>
          <ul className={styles.candidateList}>
            {candidates.map((candidate) => (
              <li key={candidate.id} className={styles.candidateItem}>
                <div className={styles.neighborInfo}>
                  <span className={styles.neighborName}>{candidate.name}</span>
                  {candidate.spaceURL && (
                    <span className={styles.neighborUrl}>{candidate.spaceURL}</span>
                  )}
                </div>
                <button
                  className={styles.addQuickButton}
                  onClick={() => handleAddCandidate(candidate)}
                  disabled={addingIds.has(candidate.id)}
                  aria-label={`${candidate.name}を隣のスペースに追加`}
                >
                  <Plus size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.2rem' }} />
                  {addingIds.has(candidate.id) ? '追加中...' : '追加'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>隣のスペースを追加</h2>
        <p className={styles.description}>スペース URL を入力して隣のスペースとして登録します。</p>
        <div className={styles.addRow}>
          <input
            type="text"
            className={styles.urlInput}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddNeighbor(); }}
            placeholder="スペースの URL を入力"
          />
          <button
            className={styles.addButton}
            onClick={handleAddNeighbor}
            disabled={isAdding || !urlInput.trim()}
          >
            {isAdding ? '検索中...' : '追加する'}
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>登録済みの隣のスペース</h2>
        {neighbors.length === 0 ? (
          <p className={styles.emptyText}>まだ隣のスペースはありません</p>
        ) : (
          <ul className={styles.neighborList}>
            {neighbors.map((neighbor) => (
              <li key={neighbor.id} className={styles.neighborItem}>
                <div className={styles.neighborInfo}>
                  <span className={styles.neighborName}>{neighbor.name}</span>
                  {neighbor.spaceURL && (
                    <span className={styles.neighborUrl}>{neighbor.spaceURL}</span>
                  )}
                </div>
                <button
                  className={styles.deleteButton}
                  onClick={() => handleRemoveNeighbor(neighbor.id)}
                  aria-label={`${neighbor.name}を削除`}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
