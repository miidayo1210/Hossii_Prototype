import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { generateId } from '../../core/utils';
import type { Space, SpaceDecoration, SpaceDecorationType } from '../../core/types/space';
import { resolvePaneDecorations } from '../../core/utils/resolvePaneDecorations';
import { hasPaneColumnOverride, isAdditionalPane } from '../../core/utils/paneOverrideFields';
import {
  PaneOverrideSaveError,
  resetPaneDecorationsOverride,
  savePaneDecorationsOverride,
} from '../../core/utils/savePaneSettingOverride';
import { useSettingsEditPane } from './SettingsEditPaneContext';
import { PaneOverrideHint } from './PaneOverrideHint';
import sharedStyles from './SettingsShared.module.css';
import styles from './DecorationTab.module.css';

type Props = {
  space: Space;
  onDirtyChange?: (dirty: boolean) => void;
};

const TYPE_LABELS: Record<SpaceDecorationType, string> = {
  bulletin_board: '掲示板',
  sign: '看板',
  image: '画像',
};

const TYPE_ICONS: Record<SpaceDecorationType, string> = {
  bulletin_board: '📋',
  sign: '🪧',
  image: '🖼',
};

type EditorState = {
  mode: 'add' | 'edit';
  decorationId?: string;
  type: SpaceDecorationType;
  title: string;
  body: string;
  imageUrl: string;
  linkUrl: string;
  x: string;
  y: string;
};

const EMPTY_EDITOR: EditorState = {
  mode: 'add',
  type: 'bulletin_board',
  title: '',
  body: '',
  imageUrl: '',
  linkUrl: '',
  x: '50',
  y: '50',
};

export const DecorationTab = ({ space, onDirtyChange }: Props) => {
  const { editPane, saveContext } = useSettingsEditPane();
  const decorations = useMemo(
    () => resolvePaneDecorations(editPane, space),
    [editPane, space],
  );
  const [localDecorations, setLocalDecorations] = useState(decorations);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalDecorations(decorations);
    setEditor(null);
  }, [decorations, editPane?.id]);

  useEffect(() => {
    onDirtyChange?.(false);
  }, [editPane?.id, onDirtyChange]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const hasOverride =
    editPane != null && isAdditionalPane(editPane) && hasPaneColumnOverride(editPane, 'decorations');

  const persistDecorations = async (next: SpaceDecoration[], successMessage: string) => {
    if (!saveContext) return;
    setIsSaving(true);
    try {
      await savePaneDecorationsOverride(saveContext, next);
      setLocalDecorations(next);
      setToast({ message: successMessage, type: 'success' });
    } catch (err) {
      console.error('[DecorationTab] save failed', err);
      const message =
        err instanceof PaneOverrideSaveError
          ? err.message
          : '保存に失敗しました';
      setToast({ message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!saveContext || !editPane || !isAdditionalPane(editPane)) return;
    setIsSaving(true);
    try {
      await resetPaneDecorationsOverride(saveContext);
      const next = resolvePaneDecorations({ ...editPane, decorations: null }, space);
      setLocalDecorations(next);
      setToast({ message: 'Space 設定に戻しました', type: 'success' });
    } catch (err) {
      console.error('[DecorationTab] reset failed', err);
      setToast({ message: 'リセットに失敗しました', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const openAddEditor = () => {
    setEditor({ ...EMPTY_EDITOR });
  };

  const openEditEditor = (d: SpaceDecoration) => {
    setEditor({
      mode: 'edit',
      decorationId: d.id,
      type: d.type,
      title: d.content.title ?? '',
      body: d.content.body,
      imageUrl: d.imageUrl ?? '',
      linkUrl: d.linkUrl ?? '',
      x: String(d.position.x),
      y: String(d.position.y),
    });
  };

  const handleSave = () => {
    if (!editor) return;
    if (!editor.body.trim() && editor.type !== 'image') return;
    if (editor.type === 'image' && !editor.imageUrl.trim()) return;

    const x = Math.min(100, Math.max(0, Number(editor.x) || 50));
    const y = Math.min(100, Math.max(0, Number(editor.y) || 50));

    const payload: Omit<SpaceDecoration, 'id'> = {
      type: editor.type,
      position: { x, y },
      content: {
        title: editor.title.trim() || undefined,
        body: editor.body.trim() || editor.title.trim() || ' ',
      },
      imageUrl: editor.imageUrl.trim() || undefined,
      linkUrl: editor.linkUrl.trim() || undefined,
    };

    if (editor.mode === 'add') {
      const newDecoration: SpaceDecoration = { id: generateId(), ...payload };
      void persistDecorations([...localDecorations, newDecoration], '装飾を追加しました');
    } else {
      void persistDecorations(
        localDecorations.map((d) =>
          d.id === editor.decorationId ? { ...d, ...payload } : d,
        ),
        '装飾を更新しました',
      );
    }
    setEditor(null);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('この装飾を削除しますか？')) return;
    void persistDecorations(
      localDecorations.filter((d) => d.id !== id),
      '装飾を削除しました',
    );
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>スペース装飾</h2>
      <p className={styles.description}>
        スペース上に掲示板・看板・画像などのウィジェットを配置できます。参加者は閲覧のみ可能です。
      </p>

      {editPane && isAdditionalPane(editPane) && (
        <PaneOverrideHint hasOverride={hasOverride} onReset={handleReset} />
      )}

      {localDecorations.length > 0 && (
        <div className={styles.list}>
          {localDecorations.map((d) => (
            <div key={d.id} className={styles.item}>
              <div className={styles.itemIcon}>{TYPE_ICONS[d.type] ?? '📋'}</div>
              <div className={styles.itemContent}>
                <p className={styles.itemTitle}>
                  {TYPE_LABELS[d.type]}
                  {d.content.title ? ` — ${d.content.title}` : ''}
                </p>
                <p className={styles.itemBody}>
                  {d.content.body.slice(0, 80)}{d.content.body.length > 80 ? '…' : ''}
                </p>
                <p className={styles.itemPos}>
                  位置: X={d.position.x}% / Y={d.position.y}%
                </p>
              </div>
              <div className={styles.itemActions}>
                <button type="button" className={styles.editButton} onClick={() => openEditEditor(d)} title="編集" disabled={isSaving}>
                  <Pencil size={13} />
                </button>
                <button type="button" className={styles.deleteButton} onClick={() => handleDelete(d.id)} title="削除" disabled={isSaving}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!editor ? (
        <button type="button" className={styles.addButton} onClick={openAddEditor} disabled={isSaving}>
          <Plus size={14} />
          装飾を追加
        </button>
      ) : (
        <div className={styles.editor}>
          <h3 className={styles.editorTitle}>
            {editor.mode === 'add' ? '装飾を追加' : '装飾を編集'}
          </h3>

          <div className={styles.formGroup}>
            <label className={styles.label}>種類</label>
            <select
              className={styles.input}
              value={editor.type}
              onChange={(e) => setEditor({ ...editor, type: e.target.value as SpaceDecorationType })}
            >
              {(Object.keys(TYPE_LABELS) as SpaceDecorationType[]).map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

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

          {editor.type !== 'image' && (
            <div className={styles.formGroup}>
              <label className={styles.label}>本文</label>
              <textarea
                className={styles.textarea}
                placeholder={editor.type === 'sign' ? '看板に表示するテキスト' : '掲示板の内容を入力してください'}
                value={editor.body}
                onChange={(e) => setEditor({ ...editor, body: e.target.value })}
                rows={4}
                maxLength={500}
              />
            </div>
          )}

          {editor.type === 'image' && (
            <div className={styles.formGroup}>
              <label className={styles.label}>画像 URL</label>
              <input
                type="url"
                className={styles.input}
                placeholder="https://..."
                value={editor.imageUrl}
                onChange={(e) => setEditor({ ...editor, imageUrl: e.target.value })}
              />
            </div>
          )}

          {editor.type === 'sign' && (
            <div className={styles.formGroup}>
              <label className={styles.label}>リンク URL（任意）</label>
              <input
                type="url"
                className={styles.input}
                placeholder="https://..."
                value={editor.linkUrl}
                onChange={(e) => setEditor({ ...editor, linkUrl: e.target.value })}
              />
            </div>
          )}

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
            <button type="button" className={styles.cancelButton} onClick={() => setEditor(null)}>
              <X size={14} />
              キャンセル
            </button>
            <button
              type="button"
              className={styles.saveButton}
              onClick={handleSave}
              disabled={
                isSaving ||
                (editor.type !== 'image' && !editor.body.trim()) ||
                (editor.type === 'image' && !editor.imageUrl.trim())
              }
            >
              <Check size={14} />
              {editor.mode === 'add' ? '追加する' : '更新する'}
            </button>
          </div>
        </div>
      )}

      {localDecorations.length === 0 && !editor && (
        <p className={styles.empty}>まだ装飾が追加されていません</p>
      )}

      {toast && (
        <div className={`${sharedStyles.toast} ${toast.type === 'success' ? sharedStyles.toastSuccess : sharedStyles.toastError}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};
