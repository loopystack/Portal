import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi, revenueApi, type AdminMember, type RevenueEntryResponse } from '../../api/client';
import { getAppLocalParts, getTodayInAppTz } from '../../utils/datetime';
import styles from './AdminRevenueHistory.module.css';

function formatMoney(n: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getYears(): number[] {
  const { year } = getAppLocalParts();
  return [year, year - 1, year - 2, year - 3, year - 4];
}

const PERIODS = ['all', 'monthly', 'yearly'] as const;
type Period = (typeof PERIODS)[number];

function getRange(
  period: Period,
  opts?: { month?: number; year?: number; yearYearly?: number }
): { from: string; to: string } {
  const today = getTodayInAppTz();
  const { year: yNow, month: mNow } = getAppLocalParts();
  switch (period) {
    case 'all':
      return { from: `${yNow - 10}-01-01`, to: today };
    case 'monthly': {
      const y = opts?.year ?? yNow;
      const m = opts?.month ?? mNow;
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { from: start, to: end };
    }
    case 'yearly': {
      const y = opts?.yearYearly ?? yNow;
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
    default:
      return { from: `${yNow - 10}-01-01`, to: today };
  }
}

export default function AdminRevenueHistory() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [period, setPeriod] = useState<Period>('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => getAppLocalParts().month);
  const [selectedYear, setSelectedYear] = useState<number>(() => getAppLocalParts().year);
  const [selectedYearYearly, setSelectedYearYearly] = useState<number>(() => getAppLocalParts().year);
  const [entries, setEntries] = useState<RevenueEntryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const fetchMembers = useCallback(async () => {
    try {
      const list = await adminApi.listMembers();
      setMembers(list);
      if (list.length > 0 && !selectedUserId) {
        setSelectedUserId(list[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load members');
    }
  }, [selectedUserId]);

  const { from, to } = getRange(period, {
    month: selectedMonth,
    year: selectedYear,
    yearYearly: selectedYearYearly,
  });

  const fetchEntries = useCallback(async () => {
    if (!selectedUserId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    const id = ++fetchIdRef.current;
    setLoading(true);
    setError('');
    try {
      const list = await revenueApi.listEntries(from, to, selectedUserId);
      if (id === fetchIdRef.current) {
        setEntries(list);
      }
    } catch (e) {
      if (id === fetchIdRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load revenue history');
        setEntries([]);
      }
    } finally {
      if (id === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [selectedUserId, from, to]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleStartEdit = (entry: RevenueEntryResponse) => {
    setEditingId(entry.id);
    setEditDate(entry.date);
    setEditAmount(String(entry.amount));
    setEditNote(entry.note ?? '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const amount = parseFloat(editAmount);
    if (Number.isNaN(amount) || amount === 0) {
      setError('Enter a valid amount (positive or negative)');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await revenueApi.updateEntry(editingId, {
        date: editDate.slice(0, 10),
        amount,
        note: editNote.trim() || undefined,
      });
      setEditingId(null);
      await fetchEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this revenue entry? This cannot be undone.')) return;
    setDeletingId(id);
    setError('');
    try {
      await revenueApi.deleteEntry(id);
      await fetchEntries();
      if (editingId === id) setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const selectedMember = members.find((m) => m.id === selectedUserId);

  return (
    <>
      <header className={styles.header}>
        <div>
          <h2>Revenue History</h2>
          <p className={styles.subtitle}>View and manage every user&apos;s revenue entries.</p>
        </div>
        {error && <div className={styles.error}>{error}</div>}
      </header>

      <div className={styles.card}>
        <div className={styles.filters}>
          <label>
            User
            <select
              className={styles.select}
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              aria-label="Select user"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName || m.email}
                </option>
              ))}
            </select>
          </label>
          <label>
            Period
            <select
              className={styles.select}
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              aria-label="Select period"
            >
              <option value="all">All (last 10 years)</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          {period === 'monthly' && (
            <>
              <label>
                Month
                <select
                  className={styles.select}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  aria-label="Select month"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i} value={i + 1}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                Year
                <select
                  className={styles.select}
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  aria-label="Select year"
                >
                  {getYears().map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          {period === 'yearly' && (
            <label>
              Year
              <select
                className={styles.select}
                value={selectedYearYearly}
                onChange={(e) => setSelectedYearYearly(Number(e.target.value))}
                aria-label="Select year"
              >
                {getYears().map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {loading ? (
          <p className={styles.loading}>Loading revenue history…</p>
        ) : !selectedUserId ? (
          <p className={styles.empty}>Select a user to view their revenue history.</p>
        ) : entries.length === 0 ? (
          <p className={styles.empty}>
            No revenue entries for {selectedMember?.displayName || selectedMember?.email} in this period.
          </p>
        ) : (
          <ul className={styles.historyList}>
            {entries.map((entry) => (
              <li key={entry.id} className={styles.historyItem}>
                {editingId === entry.id ? (
                  <form onSubmit={handleSaveEdit} className={styles.inlineForm}>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      required
                      aria-label="Date"
                    />
                    <input
                      type="number"
                      step={0.01}
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      placeholder="Amount"
                      aria-label="Amount"
                    />
                    <input
                      type="text"
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="Note"
                      aria-label="Note"
                    />
                    <button type="submit" className={styles.btnSmall} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={handleCancelEdit} className={styles.btnSmallSecondary}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <span className={styles.historyDate}>{entry.date}</span>
                    <span className={entry.amount < 0 ? styles.historyAmountNegative : styles.historyAmount}>
                      {formatMoney(entry.amount)}
                    </span>
                    {entry.note && <span className={styles.historyNote}>{entry.note}</span>}
                    <span className={styles.actions}>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(entry)}
                        className={styles.btnSmallSecondary}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        className={styles.btnDangerSmall}
                        disabled={deletingId === entry.id}
                      >
                        {deletingId === entry.id ? '…' : 'Remove'}
                      </button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
