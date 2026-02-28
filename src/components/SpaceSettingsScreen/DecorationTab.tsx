import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { generateId } from '../../core/utils';
import { useHossiiStore } from '../../core/hooks/useHossiiStore';
import type { Space, SpaceDecoration } from '../../core/types/space';
import styles from './DecorationTab.module.css';

type Props = {
  space: Space;
};

type EditorState = {
  mode: 'add' | 'edit';
  decorationId?: string;
  title: string;
  body: string;
  x: string;
  y: string;
};

const EMPTY_EDITOR: EditorState = {
  mode: 'add',
  title: '',
  body: '',
  x: '50',
  y: '50',
};

export const DecorationTab = ({ space }: Props) => {
  const { updateSpace } = useHossiiStore();
  const decorations = space.decorations ?? [];
  const [editor, setEditor] = useState<EditorState | null>(null);

  const saveDecorations = (next: SpaceDecoration[]) => {
    updateSpace(space.id, { decorations: next });
  };

  const openAddEditor = () => {
    setEditor({ ...EMPTY_EDITOR });
  };

  const openEditEditor = (d: SpaceDecoration) => {
    setEditor({
      mode: 'edit',
      decorationId: d.id,
      title: d.content.title ?? '',
      body: d.content.body,
      x: String(d.position.x),
      y: String(d.position.y),
    });
  };

  const handleSave = () => {
    if (!editor) return;
    if (!editor.body.trim()) return;

    const x = Math.min(100, Math.max(0, Number(editor.x) || 50));
    const y = Math.min(100, Math.max(0, Number(editor.y) || 50));

    if (editor.mode === 'add') {
      const newDecoration: SpaceDecoration = {
        id: generateId(),
        type: 'bulletin_board',
        position: { x, y },
        content: {
          title: editor.title.trim() || undefined,
          body: editor.body.trim(),
        },
      };
      saveDecorations([...decorations, newDecoration]);
    } else {
      saveDecorations(
        decorations.map((d) =>
          d.id === editor.decorationId
            ? {
                ...d,
                position: { x, y },
                content: {
                  title: editor.title.trim() || undefined,
                  body: editor.body.trim(),
                },
              }
            : d
        )
      );
    }
    setEditor(null);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('この装飾を削除しますか？')) return;
    saveDecorations(decorations.filter((d) => d.id !== id));
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>スペース装飾</h2>
      <p className={styles.description}>
        スペース上に掲示板などのウィジェットを配置できます。参加者は閲覧のみ可能です。
      </p>

      {/* 装飾一覧 */}
      {decorations.length > 0 && (
        <div className={styles.list}>
          {decorations.map((d) => (
            <div key={d.id} className={styles.item}>
              <div className={styles.itemIcon}>📋</div>
              <div className={styles.itemContent}>
                {d.content.title && (
                  <p className={styles.itemTitle}>{d.content.title}</p>
                )}
                <p className={styles.itemBody}>
                  {d.content.body.slice(0, 80)}{d.content.body.length > 80 ? '…' : ''}
                </p>
                <p className={styles.itemPos}>
                  位置: X={d.position.x}% / Y={d.position.y}%
                </p>
              </div>
              <div className={styles.itemActions}>
                <button
                  type="button"
                  className={styles.editButton}
                  onClick={() => openEditEditor(d)}
                  title="編集"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={() => handleDelete(d.id)}
                  title="削除"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!editor ? (
        <button
          type="button"
          className={styles.addButton}
          onClick={openAddEditor}
        >
          <Plus size={14} />
          装飾を追加
        </button>
      ) : (
        <div className={styles.editor}>
          <h3 className={styles.editorTitle}>
            {editor.mode === 'add' ? '装飾を追加' : '装飾を編集'}
          </h3>

          <div className={styles.formGroup}>
            <label className={styles.label}>タイトル（任意）</label>
            <input
              type="text"
              className={styles.input}
              placeholder="例: お知らせ"
              value={editor.title}
              onChange={(e) => setEditor({ ...editor, title: e.target.value })}
              maxLength={40}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>本文</label>
            <textarea
              className={styles.textarea}
              placeholder="掲示板の内容を入力してください"
              value={editor.body}
              onChange={(e) => setEditor({ ...editor, body: e.target.value })}
              rows={4}
              maxLength={500}
            />
          </div>

          <div className={styles.posRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>X位置（%）</label>
              <input
                type="number"
                className={styles.inputSmall}
                min={0}
                max={100}
                value={editor.x}
                onChange={(e) => setEditor({ ...editor, x: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Y位置（%）</label>
              <input
                type="number"
                className={styles.inputSmall}
                min={0}
                max={100}
                value={editor.y}
                onChange={(e) => setEditor({ ...editor, y: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.editorActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => setEditor(null)}
            >
              <X size={14} />
              キャンセル
            </button>
            <button
              type="button"
              className={styles.saveButton}
              onClick={handleSave}
              disabled={!editor.body.trim()}
            >
              <Check size={14} />
              {editor.mode === 'add' ? '追加する' : '更新する'}
            </button>
          </div>
        </div>
      )}

      {decorations.length === 0 && !editor && (
        <p className={styles.empty}>まだ装飾が追加されていません</p>
      )}
    </div>
  );
};
