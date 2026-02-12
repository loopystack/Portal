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
  ComposedChart,
  Line,
  Cell,
} from 'recharts';
import { rankingsApi, type WorkHoursRankItem, type RevenueRankItem } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../../components/ThemeToggle';
import styles from './Rankings.module.css';

const WORK_PERIODS = ['daily', 'weekly', 'monthly', 'total'] as const;
type WorkPeriod = (typeof WORK_PERIODS)[number];

const REVENUE_PERIODS = ['monthly', 'total', 'specific'] as const;
type RevenuePeriod = (typeof REVENUE_PERIODS)[number];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function getYears(): number[] {
  const y = new Date().getFullYear();
  return [y, y - 1, y - 2, y - 3, y - 4];
}

function formatHours(h: number): string {
  if (h < 0.01) return '0h';
  const hrs = Math.floor(h);
  const m = Math.round((h - hrs) * 60);
  if (m === 0) return `${hrs}h`;
  return `${hrs}h ${m}m`;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function truncateName(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

export default function Rankings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const name = user?.display_name || user?.email || 'Member';

  const [workHours, setWorkHours] = useState<WorkHoursRankItem[]>([]);
  const [revenue, setRevenue] = useState<RevenueRankItem[]>([]);
  const [revenueForMonth, setRevenueForMonth] = useState<RevenueRankItem[] | null>(null);
  const [workPeriod, setWorkPeriod] = useState<WorkPeriod>('total');
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>('monthly');
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [wh, rev] = await Promise.all([rankingsApi.workHours(), rankingsApi.revenue()]);
      setWorkHours(wh);
      setRevenue(rev);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rankings');
      setWorkHours([]);
      setRevenue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  const fetchRevenueForMonth = useCallback(async (year: number, month: number) => {
    setRevenueLoading(true);
    try {
      const rev = await rankingsApi.revenue(year, month);
      setRevenueForMonth(rev);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load revenue for month');
    } finally {
      setRevenueLoading(false);
    }
  }, []);

  useEffect(() => {
    if (revenuePeriod === 'specific') {
      fetchRevenueForMonth(selectedYear, selectedMonth);
    } else {
      setRevenueForMonth(null);
    }
  }, [revenuePeriod, selectedYear, selectedMonth, fetchRevenueForMonth]);

  const workHoursKey = workPeriod === 'daily' ? 'dailyHours' : workPeriod === 'weekly' ? 'weeklyHours' : workPeriod === 'monthly' ? 'monthlyHours' : 'totalHours';
  const workChartData = workHours.map((r, i) => ({
    name: truncateName(r.displayName, 14),
    fullName: r.displayName,
    value: r[workHoursKey],
    rank: i + 1,
  }));

  const revenueSource = revenuePeriod === 'specific' ? revenueForMonth : revenue;
  const revenueChartData = (revenueSource ?? []).map((r, i) => ({
    name: truncateName(r.displayName, 14),
    fullName: r.displayName,
    value: revenuePeriod === 'total' ? r.totalRevenue : r.monthlyRevenue,
    expected: r.expectedRevenue ?? 0,
    rank: i + 1,
  }));

  const getWorkPeriodLabel = () => {
    switch (workPeriod) {
      case 'daily': return 'Today';
      case 'weekly': return 'This week';
      case 'monthly': return 'This month';
      default: return 'All time';
    }
  };

  const getRevenuePeriodLabel = () => {
    if (revenuePeriod === 'monthly') return 'This month (with target)';
    if (revenuePeriod === 'total') return 'All time';
    return `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}${revenueForMonth != null ? ' (with target)' : ''}`;
  };

  const medalColor = (i: number) => (i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--accent)');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>PYCE Portal</h1>
        <nav className={styles.nav}>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/time-record">Time Record</Link>
          <Link to="/revenue">Revenue</Link>
          <Link to="/rankings" className={styles.navActive}>Rankings</Link>
          {user?.role === 'admin' && <Link to="/admin" className={styles.adminLink}>Admin</Link>}
          <ThemeToggle />
          <span className={styles.user}>{name}</span>
          <button type="button" onClick={() => { logout(); navigate('/signin', { replace: true }); }} className={styles.logoutBtn}>Sign out</button>
        </nav>
      </header>
      <main className={styles.main}>
        <header className={styles.mainHeader}>
          <div>
            <h2>Rankings</h2>
            <p className={styles.subtitle}>All members — work hours & revenue. Compete and grow.</p>
          </div>
          {error && <div className={styles.error}>{error}</div>}
        </header>

        {loading ? (
          <p className={styles.loading}>Loading rankings…</p>
        ) : (
          <div className={styles.dashboard}>
            {/* Hero: Work hours chart */}
            <section className={styles.heroWork}>
              <div className={styles.chartHead}>
                <h3>Work hours ranking</h3>
                <div className={styles.periodTabs}>
                  {WORK_PERIODS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={workPeriod === p ? styles.tabActive : styles.tab}
                      onClick={() => setWorkPeriod(p)}
                    >
                      {p === 'daily' ? 'Daily' : p === 'weekly' ? 'Weekly' : p === 'monthly' ? 'Monthly' : 'Total'}
                    </button>
                  ))}
                </div>
              </div>
              <p className={styles.chartSub}>{getWorkPeriodLabel()} — Work blocks only</p>
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={workChartData} margin={{ top: 8, right: 8, left: 8, bottom: 56 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} angle={-35} textAnchor="end" height={52} interval={0} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(v) => `${v}h`} width={40} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                      formatter={(value: number | undefined) => [value != null ? formatHours(value) : '', 'Hours']}
                      labelFormatter={(_, payload) => (payload && payload[0] && (payload[0] as { payload?: { fullName?: string } }).payload?.fullName) ?? ''}
                    />
                    <Bar dataKey="value" name="Hours" fill="var(--accent)" radius={[4, 4, 0, 0]}>
                      {workChartData.map((_, i) => (
                        <Cell key={i} fill={medalColor(i)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Hero: Revenue chart (Monthly / Total / Select month) */}
            <section className={styles.heroRevenue}>
              <div className={styles.chartHead}>
                <h3>Revenue ranking</h3>
                <div className={styles.periodTabs}>
                  {REVENUE_PERIODS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={revenuePeriod === p ? styles.tabActive : styles.tab}
                      onClick={() => setRevenuePeriod(p)}
                    >
                      {p === 'monthly' ? 'Monthly' : p === 'total' ? 'Total' : 'Select month'}
                    </button>
                  ))}
                </div>
              </div>
              {revenuePeriod === 'specific' && (
                <div className={styles.monthPicker}>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className={styles.monthSelect}
                    aria-label="Year"
                  >
                    {getYears().map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className={styles.monthSelect}
                    aria-label="Month"
                  >
                    {MONTH_NAMES.map((name, i) => (
                      <option key={i} value={i + 1}>{name}</option>
                    ))}
                  </select>
                </div>
              )}
              <p className={styles.chartSub}>{getRevenuePeriodLabel()}</p>
              <div className={styles.chartWrap}>
                {(revenuePeriod === 'specific' && revenueLoading) ? (
                  <p className={styles.loading}>Loading revenue for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}…</p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={revenueChartData} margin={{ top: 8, right: 8, left: 8, bottom: 56 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} angle={-35} textAnchor="end" height={52} interval={0} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={44} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                        formatter={(value: number | undefined) => [value != null ? formatMoney(value) : '', '']}
                        labelFormatter={(_, payload) => (payload && payload[0] && (payload[0] as { payload?: { fullName?: string } }).payload?.fullName) ?? ''}
                      />
                      <Legend />
                      <Bar
                        dataKey="value"
                        name={revenuePeriod === 'monthly' ? 'This month' : revenuePeriod === 'total' ? 'Total' : `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
                        fill="var(--accent)"
                        radius={[4, 4, 0, 0]}
                      >
                        {revenueChartData.map((_, i) => (
                          <Cell key={i} fill={medalColor(i)} />
                        ))}
                      </Bar>
                      {(revenuePeriod === 'monthly' || revenuePeriod === 'specific') && (
                        <Line type="monotone" dataKey="expected" name="Target (expected)" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            {/* Work hours table */}
            <section className={styles.tableCard}>
              <h3>Work hours — ranking table</h3>
              <p className={styles.cardSub}>Daily · Weekly · Monthly · Total (Work only)</p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Member</th>
                      <th>Daily</th>
                      <th>Weekly</th>
                      <th>Monthly</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workHours.map((r, i) => (
                      <tr key={r.userId}>
                        <td className={styles.rankCell}>{i + 1}</td>
                        <td className={styles.nameCell}>{r.displayName}</td>
                        <td>{formatHours(r.dailyHours)}</td>
                        <td>{formatHours(r.weeklyHours)}</td>
                        <td>{formatHours(r.monthlyHours)}</td>
                        <td className={styles.totalCell}>{formatHours(r.totalHours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Revenue table */}
            <section className={styles.tableCard}>
              <h3>Revenue — ranking table</h3>
              <p className={styles.cardSub}>This month · Total · Expected (target) this month</p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Member</th>
                      <th>Monthly</th>
                      <th>Total</th>
                      <th>Expected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.map((r, i) => (
                      <tr key={r.userId}>
                        <td className={styles.rankCell}>{i + 1}</td>
                        <td className={styles.nameCell}>{r.displayName}</td>
                        <td>{formatMoney(r.monthlyRevenue)}</td>
                        <td className={styles.totalCell}>{formatMoney(r.totalRevenue)}</td>
                        <td>{r.expectedRevenue != null ? formatMoney(r.expectedRevenue) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
