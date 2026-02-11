import { useState, useEffect } from 'react';
import { timeBlocksApi, combineSummary } from '../../api/client';
import styles from './EditBlockModal.module.css';

const RECORD_TITLES = ['Work', 'Sleep', 'Idle', 'Absent'] as const;
type RecordTitle = (typeof RECORD_TITLES)[number];

function isRecordTitle(s: string | null): s is RecordTitle {
  return s != null && RECORD_TITLES.includes(s as RecordTitle);
}

interface Props {
  id: string;
  start: string;
  end: string;
  summary: string | null;
  content: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditBlockModal({ id, start, end, summary, content: initialContent, onClose, onSaved }: Props) {
  const [title, setTitle] = useState<RecordTitle>(
    isRecordTitle(summary) ? summary : 'Work'
  );
  const [content, setContent] = useState(initialContent ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Sync state when the block we're editing changes (e.g. open different event or after refetch)
  useEffect(() => {
    setTitle(isRecordTitle(summary) ? summary : 'Work');
    setContent(initialContent ?? '');
  }, [id, summary, initialContent]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await timeBlocksApi.update(id, { summary: combineSummary(title, content) });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this time block?')) return;
    setError('');
    setDeleting(true);
    try {
      await timeBlocksApi.delete(id);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const startDate = new Date(start);
  const endDate = new Date(end);
  const timeStr = (d: Date) => d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>Edit time block</h3>
        <p className={styles.timeRange}>
          {timeStr(startDate)} – {timeStr(endDate)}
        </p>
        <form onSubmit={handleSave}>
          {error && <div className={styles.error}>{error}</div>}
          <p className={styles.label}>Record type (title)</p>
          <div className={styles.titleButtons}>
            {RECORD_TITLES.map((t) => (
              <button
                key={t}
                type="button"
                className={title === t ? styles.titleBtnActive : styles.titleBtn}
                onClick={() => setTitle(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <label className={styles.labelWithField}>
            Content (editable)
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className={styles.textarea}
              rows={4}
              placeholder="Notes or details for this time record…"
            />
          </label>
          <div className={styles.actions}>
            <button type="button" onClick={onClose} className={styles.btnSecondary}>
              Cancel
            </button>
            <button type="button" onClick={handleDelete} className={styles.btnDanger} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
