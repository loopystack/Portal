import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';
import { revenueApi, type RevenueEntryResponse } from '../../api/client';
import { getAppLocalParts, getTodayInAppTz } from '../../utils/datetime';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../../components/ThemeToggle';
import styles from './Revenue.module.css';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMoney(n: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function toYMD(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Yakutsk' });
}

export default function Revenue() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const name = user?.display_name || user?.email || 'Member';

  const [entries, setEntries] = useState<RevenueEntryResponse[]>([]);
  const [expectedMonth, setExpectedMonth] = useState(() => getAppLocalParts().month);
  const [expectedYear, setExpectedYear] = useState(() => getAppLocalParts().year);
  const [expectedAmount, setExpectedAmount] = useState<number | null>(null);
  const [expectedInput, setExpectedInput] = useState('');
  const [expectedSaving, setExpectedSaving] = useState(false);
  const [entryDate, setEntryDate] = useState(getTodayInAppTz());
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [historyFrom, setHistoryFrom] = useState(() => {
    const { year, month, day } = getAppLocalParts();
    const past = new Date(year, month - 1 - 11, day);
    return toYMD(past);
  });
  const [historyTo, setHistoryTo] = useState(getTodayInAppTz());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');

  const fetchEntries = useCallback(async (from: string, to: string) => {
    try {
      const list = await revenueApi.listEntries(from, to);
      setEntries(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load entries');
      setEntries([]);
    }
  }, []);

  const fetchExpected = useCallback(async (year: number, month: number) => {
    try {
      const res = await revenueApi.getExpected(year, month);
      setExpectedAmount(res.amount);
      setExpectedInput(res.amount != null ? String(res.amount) : '');
    } catch {
      setExpectedAmount(null);
      setExpectedInput('');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    const from = new Date(historyFrom);
    const to = new Date(historyTo);
    if (from > to) {
      setLoading(false);
      return;
    }
    fetchEntries(historyFrom, historyTo).finally(() => setLoading(false));
  }, [historyFrom, historyTo, fetchEntries]);

  useEffect(() => {
    fetchExpected(expectedYear, expectedMonth);
  }, [expectedYear, expectedMonth, fetchExpected]);

  const handleSaveExpected = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expectedInput);
    if (Number.isNaN(amount) || amount < 0) {
      setError('Enter a valid amount');
      return;
    }
    setError('');
    setExpectedSaving(true);
    try {
      await revenueApi.setExpected(expectedYear, expectedMonth, amount);
      setExpectedAmount(amount);
      setExpectedByMonth((prev) => ({ ...prev, [`${expectedYear}-${expectedMonth}`]: amount }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setExpectedSaving(false);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(entryAmount);
    if (Number.isNaN(amount) || amount === 0) {
      setError('Enter a valid amount (positive for received, negative for deductions)');
      return;
    }
    if (!entryNote.trim()) {
      setError('Please enter a note for this revenue (e.g. client or cost reason).');
      return;
    }
    setError('');
    setEntrySubmitting(true);
    try {
      await revenueApi.createEntry(entryDate, amount, entryNote.trim() || undefined);
      setEntryAmount('');
      setEntryNote('');
      setEntryDate(getTodayInAppTz());
      const from = historyFrom <= entryDate ? historyFrom : entryDate;
      const to = historyTo >= entryDate ? historyTo : entryDate;
      if (from !== historyFrom || to !== historyTo) {
        setHistoryFrom(from);
        setHistoryTo(to);
      }
      await fetchEntries(from, to);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setEntrySubmitting(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Delete this revenue entry?')) return;
    try {
      await revenueApi.deleteEntry(id);
      await fetchEntries(historyFrom, historyTo);
      if (editingId === id) setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const handleStartEdit = (entry: RevenueEntryResponse) => {
    setEditingId(entry.id);
    setEditAmount(String(entry.amount));
    setEditNote(entry.note ?? '');
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
    try {
      await revenueApi.updateEntry(editingId, { amount, note: editNote.trim() || undefined });
      setEditingId(null);
      await fetchEntries(historyFrom, historyTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const handleCancelEdit = () => setEditingId(null);

  const calendarMonth = new Date(expectedYear, expectedMonth - 1, 1);
  const calendarStart = new Date(calendarMonth);
  const calendarEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
  const byDay: Record<string, number> = {};
  entries
    .filter((e) => e.date >= toYMD(calendarStart) && e.date <= toYMD(calendarEnd))
    .forEach((e) => {
      byDay[e.date] = (byDay[e.date] ?? 0) + e.amount;
    });

  const daysInMonth = new Date(expectedYear, expectedMonth, 0).getDate();
  const firstDayOfWeek = new Date(expectedYear, expectedMonth - 1, 1).getDay();
  const calendarDays: { date: string; day: number; amount: number }[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push({ date: '', day: 0, amount: 0 });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = toYMD(new Date(expectedYear, expectedMonth - 1, d));
    calendarDays.push({ date, day: d, amount: byDay[date] ?? 0 });
  }

  const thisYear = getAppLocalParts().year;
  const currentMonth = getAppLocalParts().month; // 1–12
  const thisYearMonths: { month: string; year: number; monthNum: number; revenue: number; expected: number }[] = [];
  for (let m = 1; m <= currentMonth; m++) {
    const monthStart = toYMD(new Date(thisYear, m - 1, 1));
    const monthEnd = toYMD(new Date(thisYear, m, 0));
    const rev = entries
      .filter((e) => e.date >= monthStart && e.date <= monthEnd)
      .reduce((s, e) => s + e.amount, 0);
    thisYearMonths.push({
      month: MONTH_NAMES[m - 1] + ' ' + thisYear,
      year: thisYear,
      monthNum: m,
      revenue: rev,
      expected: 0,
    });
  }

  const [expectedByMonth, setExpectedByMonth] = useState<Record<string, number>>({});
  useEffect(() => {
    const pairs: { y: number; m: number }[] = [];
    for (let m = 1; m <= currentMonth; m++) {
      pairs.push({ y: thisYear, m });
    }
    if (pairs.length === 0) {
      setExpectedByMonth({});
      return;
    }
    Promise.all(pairs.map(({ y, m }) => revenueApi.getExpected(y, m))).then((results) => {
      const map: Record<string, number> = {};
      pairs.forEach(({ y, m }, i) => {
        map[`${y}-${m}`] = results[i]?.amount ?? 0;
      });
      setExpectedByMonth(map);
    });
  }, [entries.length, thisYear, currentMonth]);

  const thisYearMonthsWithExpected = thisYearMonths.map((row) => ({
    ...row,
    expected: expectedByMonth[`${row.year}-${row.monthNum}`] ?? 0,
  }));

  const last5Years: { year: number; revenue: number; expected: number }[] = [];
  for (let y = thisYear - 4; y <= thisYear; y++) {
    const rev = entries
      .filter((e) => e.date.startsWith(String(y)))
      .reduce((s, e) => s + e.amount, 0);
    last5Years.push({ year: y, revenue: rev, expected: 0 });
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>PYCE Portal</h1>
        <nav className={styles.nav}>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/time-record">Time Record</Link>
          <Link to="/revenue" className={styles.navActive}>Revenue</Link>
          <Link to="/rankings">Rankings</Link>
          {user?.role === 'admin' && <Link to="/admin" className={styles.adminLink}>Admin</Link>}
          <ThemeToggle />
          <span className={styles.user}>{name}</span>
          <button type="button" onClick={() => { logout(); navigate('/signin', { replace: true }); }} className={styles.logoutBtn}>Sign out</button>
        </nav>
      </header>
      <main className={styles.main}>
        <header className={styles.mainHeader}>
          <h2>Revenue</h2>
          {error && <div className={styles.error}>{error}</div>}
        </header>

        <div className={styles.dashboard}>
          {/* Hero: monthly chart first, full width */}
          <section className={styles.heroChart}>
            <div className={styles.chartHead}>
              <h3>Monthly revenue</h3>
              <span className={styles.chartSub}>Received vs target (this year)</span>
            </div>
            <div className={styles.chartWrapHero}>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={thisYearMonthsWithExpected} margin={{ top: 12, right: 12, left: 12, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                    labelStyle={{ color: 'var(--text)' }}
                    formatter={(value: number | undefined) => [value != null ? formatMoney(value) : '', '']}
                    labelFormatter={(label) => label}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name="Received" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="expected" name="Target" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Row of 3 cards around the chart: target, add entry, calendar */}
          <section className={styles.cardTarget}>
            <h3>Target</h3>
            <p className={styles.cardDesc}>Expected revenue for the month</p>
            <form onSubmit={handleSaveExpected} className={styles.expectedForm}>
              <label className={styles.label}>
                <span>Month / Year</span>
                <div className={styles.row2}>
                  <select
                    value={expectedMonth}
                    onChange={(e) => setExpectedMonth(Number(e.target.value))}
                    className={styles.select}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={expectedYear}
                    onChange={(e) => setExpectedYear(Number(e.target.value))}
                    className={styles.input}
                  />
                </div>
              </label>
              <label className={styles.label}>
                Amount ($)
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={expectedInput}
                  onChange={(e) => setExpectedInput(e.target.value)}
                  placeholder="Target"
                  className={styles.input}
                />
              </label>
              <button type="submit" className={styles.btnPrimary} disabled={expectedSaving}>
                {expectedSaving ? 'Saving…' : 'Save target'}
              </button>
            </form>
            {expectedAmount != null && (
              <p className={styles.targetDisplay}>
                {MONTH_NAMES[expectedMonth - 1]} {expectedYear}: <strong>{formatMoney(expectedAmount)}</strong>
              </p>
            )}
          </section>

          <section className={styles.cardAdd}>
            <h3>Add received / deduction</h3>
            <p className={styles.cardDesc}>
              Positive = money received. Negative = deduction (e.g. server, AI tools, costs).
            </p>
            <form onSubmit={handleAddEntry} className={styles.entryForm}>
              <label className={styles.label}>
                Date
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className={styles.input}
                />
              </label>
              <label className={styles.label}>
                Amount ($)
                <input
                  type="number"
                  step={0.01}
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(e.target.value)}
                  placeholder="e.g. 100 or -50"
                  required
                  className={styles.input}
                />
              </label>
              <label className={styles.label}>
                Note
                <input
                  type="text"
                  value={entryNote}
                  onChange={(e) => setEntryNote(e.target.value)}
                  placeholder="e.g. Client X / Server costs"
                  required
                  className={styles.input}
                />
              </label>
              <button type="submit" className={styles.btnPrimary} disabled={entrySubmitting}>
                {entrySubmitting ? 'Adding…' : 'Add'}
              </button>
            </form>
          </section>

          <section className={styles.cardCalendar}>
            <h3>By day</h3>
            <p className={styles.cardDesc}>{MONTH_NAMES[expectedMonth - 1]} {expectedYear}</p>
            <div className={styles.calendarControls}>
              <select
                value={expectedMonth}
                onChange={(e) => setExpectedMonth(Number(e.target.value))}
                className={styles.select}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>{MONTH_NAMES[m - 1]}</option>
                ))}
              </select>
              <input
                type="number"
                min={2000}
                max={2100}
                value={expectedYear}
                onChange={(e) => setExpectedYear(Number(e.target.value))}
                className={styles.inputNum}
              />
            </div>
            <div className={styles.calendarGrid}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className={styles.calendarHeader}>{d}</div>
              ))}
              {calendarDays.map((cell, i) => (
                <div
                  key={cell.date || `e-${i}`}
                  className={cell.date ? styles.calendarCell : styles.calendarCellEmpty}
                >
                  {cell.date ? (
                    <>
                      <span className={styles.calendarDayNum}>{cell.day}</span>
                      {cell.amount !== 0 && (
                        <span className={cell.amount < 0 ? styles.calendarAmountNegative : styles.calendarAmount}>
                          {formatMoney(cell.amount)}
                        </span>
                      )}
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          {/* History + Yearly side by side */}
          <section className={styles.cardHistory}>
            <h3>History</h3>
            <div className={styles.historyFilters}>
              <input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} className={styles.input} />
              <span className={styles.toLabel}>to</span>
              <input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} className={styles.input} />
            </div>
            {loading ? (
              <p className={styles.muted}>Loading…</p>
            ) : entries.length === 0 ? (
              <p className={styles.muted}>No entries in this range.</p>
            ) : (
              <ul className={styles.historyList}>
                {entries.map((entry) => (
                  <li key={entry.id} className={styles.historyItem}>
                    {editingId === entry.id ? (
                      <form onSubmit={handleSaveEdit} className={styles.inlineForm}>
                        <input type="number" step={0.01} value={editAmount} onChange={(e) => setEditAmount(e.target.value)} placeholder="+ or -" className={styles.input} />
                        <input type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Note" className={styles.input} />
                        <button type="submit" className={styles.btnSmall}>Save</button>
                        <button type="button" onClick={handleCancelEdit} className={styles.btnSmallSecondary}>Cancel</button>
                      </form>
                    ) : (
                      <>
                        <span className={styles.historyDate}>{entry.date}</span>
                        <span className={entry.amount < 0 ? styles.historyAmountNegative : styles.historyAmount}>{formatMoney(entry.amount)}</span>
                        {entry.note && <span className={styles.historyNote}>{entry.note}</span>}
                        <button type="button" onClick={() => handleStartEdit(entry)} className={styles.btnSmallSecondary}>Edit</button>
                        <button type="button" onClick={() => handleDeleteEntry(entry.id)} className={styles.btnDangerSmall}>Del</button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.cardYearly}>
            <h3>Yearly</h3>
            <p className={styles.cardDesc}>Last 5 years</p>
            <div className={styles.chartWrapSmall}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={last5Years} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="year" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                    formatter={(value: number | undefined) => [value != null ? formatMoney(value) : '', '']}
                  />
                  <Bar dataKey="revenue" name="Received" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
