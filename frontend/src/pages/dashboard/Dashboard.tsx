import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { timeBlocksApi, parseSummary, revenueApi, rankingsApi } from '../../api/client';
import {
  formatDateTimeInAppTz,
  getAppLocalParts,
  getMonthEndISO,
  getMonthStartISO,
  getTodayEndISO,
  getTodayStartISO,
  getWeekStartISO,
} from '../../utils/datetime';
import type { TimeBlockResponse, RevenueEntryResponse, WorkHoursRankItem, RevenueRankItem } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../../components/ThemeToggle';
import styles from './Dashboard.module.css';

function formatHours(ms: number): string {
  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function toMs(s: string): number {
  return new Date(s).getTime();
}

const BLOCK_TITLES: Record<string, string> = {
  Work: 'Work',
  Sleep: 'Sleep',
  Idle: 'Idle',
  Absent: 'Absent',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const name = user?.display_name || user?.email || 'Member';

  const [monthWorkMs, setMonthWorkMs] = useState<number>(0);
  const [weekWorkMs, setWeekWorkMs] = useState<number>(0);
  const [todayWorkMs, setTodayWorkMs] = useState<number>(0);
  const [hoursLoading, setHoursLoading] = useState(true);

  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(0);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [expectedRevenue, setExpectedRevenue] = useState<number | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);

  const [recentBlocks, setRecentBlocks] = useState<TimeBlockResponse[]>([]);
  const [recentEntries, setRecentEntries] = useState<RevenueEntryResponse[]>([]);
  const [weekChartData, setWeekChartData] = useState<{ day: string; hours: number; label: string }[]>([]);

  const [workRank, setWorkRank] = useState<number | null>(null);
  const [revenueRank, setRevenueRank] = useState<number | null>(null);
  const [rankingsLoading, setRankingsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const todayStart = new Date(getTodayStartISO());
    const todayEnd = new Date(getTodayEndISO());
    const monthStart = new Date(getMonthStartISO());
    const monthEnd = new Date(getMonthEndISO());
    const weekStart = new Date(getWeekStartISO());

    const from = weekStart.toISOString();
    const to = monthEnd.toISOString();

    timeBlocksApi
      .list(from, to)
      .then((blocks) => {
        if (cancelled) return;
        const workOnly = blocks.filter((b) => parseSummary(b.summary).title === 'Work');

        const todayMs = workOnly
          .filter((b) => toMs(b.endAt) > todayStart.getTime() && toMs(b.startAt) < todayEnd.getTime())
          .reduce(
            (sum, b) =>
              sum + Math.min(toMs(b.endAt), todayEnd.getTime()) - Math.max(toMs(b.startAt), todayStart.getTime()),
            0
          );
        const monthMs = workOnly
          .filter((b) => toMs(b.endAt) > monthStart.getTime() && toMs(b.startAt) < monthEnd.getTime())
          .reduce(
            (sum, b) =>
              sum + Math.min(toMs(b.endAt), monthEnd.getTime()) - Math.max(toMs(b.startAt), monthStart.getTime()),
            0
          );
        const weekMs = workOnly
          .filter((b) => toMs(b.endAt) > weekStart.getTime() && toMs(b.startAt) < todayEnd.getTime())
          .reduce(
            (sum, b) =>
              sum + Math.min(toMs(b.endAt), todayEnd.getTime()) - Math.max(toMs(b.startAt), weekStart.getTime()),
            0
          );

        setTodayWorkMs(todayMs);
        setMonthWorkMs(monthMs);
        setWeekWorkMs(weekMs);

        const recent = [...blocks].sort((a, b) => toMs(b.endAt) - toMs(a.endAt)).slice(0, 10);
        setRecentBlocks(recent);

        const chartData: { day: string; hours: number; label: string }[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
          const dayEnd = new Date(d.getTime() + 24 * 60 * 60 * 1000);
          const ms = workOnly
            .filter((b) => toMs(b.endAt) > d.getTime() && toMs(b.startAt) < dayEnd.getTime())
            .reduce(
              (sum, b) =>
                sum + Math.min(toMs(b.endAt), dayEnd.getTime()) - Math.max(toMs(b.startAt), d.getTime()),
              0
            );
          const dayOfWeek = new Date(d.getTime() + 9 * 60 * 60 * 1000).getUTCDay();
          chartData.push({
            day: DAY_NAMES[dayOfWeek],
            hours: Math.round((ms / (1000 * 60 * 60)) * 10) / 10,
            label: `${DAY_NAMES[dayOfWeek]} ${formatHours(ms)}`,
          });
        }
        setWeekChartData(chartData);
      })
      .catch(() => {
        if (!cancelled) {
          setTodayWorkMs(0);
          setMonthWorkMs(0);
          setWeekWorkMs(0);
          setRecentBlocks([]);
          setWeekChartData([]);
        }
      })
      .finally(() => {
        if (!cancelled) setHoursLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const { year, month } = getAppLocalParts();
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEndStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const farPast = '2000-01-01';

    Promise.all([
      revenueApi.listEntries(farPast, monthEndStr),
      revenueApi.getExpected(year, month),
    ])
      .then(([entries, expected]) => {
        if (cancelled) return;
        const monthly = entries
          .filter((e) => e.date >= monthStart && e.date <= monthEndStr)
          .reduce((sum, e) => sum + e.amount, 0);
        const total = entries.reduce((sum, e) => sum + e.amount, 0);
        setMonthlyRevenue(monthly);
        setTotalRevenue(total);
        setExpectedRevenue(expected.amount);

        const recent = [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
        setRecentEntries(recent);
      })
      .catch(() => {
        if (!cancelled) {
          setMonthlyRevenue(0);
          setTotalRevenue(0);
          setExpectedRevenue(null);
          setRecentEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) setRevenueLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    Promise.all([rankingsApi.workHours(), rankingsApi.revenue()])
      .then(([workList, revenueList]) => {
        if (cancelled) return;
        const wIndex = (workList as WorkHoursRankItem[]).findIndex((r) => r.userId === user.id);
        const rIndex = (revenueList as RevenueRankItem[]).findIndex((r) => r.userId === user.id);
        setWorkRank(wIndex >= 0 ? wIndex + 1 : null);
        setRevenueRank(rIndex >= 0 ? rIndex + 1 : null);
      })
      .catch(() => {
        if (!cancelled) {
          setWorkRank(null);
          setRevenueRank(null);
        }
      })
      .finally(() => {
        if (!cancelled) setRankingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleLogout = () => {
    logout();
    navigate('/signin', { replace: true });
  };

  const welcomeDate = formatDateTimeInAppTz(new Date(), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const revenueGoalPercent =
    expectedRevenue != null && expectedRevenue > 0
      ? Math.min(100, Math.round((monthlyRevenue / expectedRevenue) * 100))
      : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>PYCE Portal</h1>
        <nav className={styles.nav}>
          <Link to="/dashboard" className={styles.navActive}>Dashboard</Link>
          <Link to="/time-record">Time Record</Link>
          <Link to="/revenue">Revenue</Link>
          <Link to="/rankings">Rankings</Link>
          {user?.role === 'admin' && (
            <Link to="/admin" className={styles.adminLink}>Admin</Link>
          )}
          <ThemeToggle />
          <span className={styles.user}>{name}</span>
          <button type="button" onClick={handleLogout} className={styles.logoutBtn}>Sign out</button>
        </nav>
      </header>

      <main className={styles.main}>
        {/* Welcome + Quick actions */}
        <section className={styles.welcomeSection}>
          <div className={styles.welcomeText}>
            <h2 className={styles.welcomeTitle}>Welcome back, {name}</h2>
            <p className={styles.welcomeDate}>{welcomeDate}</p>
            <p className={styles.welcomeSub}>Here’s your overview — everything in one place.</p>
          </div>
          <div className={styles.quickActions}>
            <Link to="/team-time" className={styles.quickBtn}>
              <span className={styles.quickBtnIcon}>👥</span>
              Team time logs
            </Link>
            <Link to="/time-record" className={styles.quickBtn}>
              <span className={styles.quickBtnIcon}>⏱</span>
              Log time
            </Link>
            <Link to="/revenue" className={styles.quickBtn}>
              <span className={styles.quickBtnIcon}>💰</span>
              Add revenue
            </Link>
            <Link to="/rankings" className={styles.quickBtn}>
              <span className={styles.quickBtnIcon}>🏆</span>
              View rankings
            </Link>
          </div>
        </section>

        {/* Key metrics – 6 cards */}
        <section className={styles.metricsSection}>
          <h3 className={styles.sectionTitle}>Key metrics</h3>
          <div className={styles.cards}>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Today’s hours</span>
              <span className={styles.cardValue}>{hoursLoading ? '…' : formatHours(todayWorkMs)}</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>This week</span>
              <span className={styles.cardValue}>{hoursLoading ? '…' : formatHours(weekWorkMs)}</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>This month</span>
              <span className={styles.cardValue}>{hoursLoading ? '…' : formatHours(monthWorkMs)}</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Monthly revenue</span>
              <span className={styles.cardValue}>{revenueLoading ? '…' : formatMoney(monthlyRevenue)}</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Total revenue</span>
              <span className={styles.cardValue}>{revenueLoading ? '…' : formatMoney(totalRevenue)}</span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardLabel}>Expected this month</span>
              <span className={styles.cardValue}>
                {revenueLoading ? '…' : expectedRevenue != null ? formatMoney(expectedRevenue) : '—'}
              </span>
            </div>
          </div>
        </section>

        {/* Revenue goal progress */}
        {expectedRevenue != null && expectedRevenue > 0 && (
          <section className={styles.goalSection}>
            <div className={styles.goalHeader}>
              <span className={styles.goalLabel}>Monthly revenue goal</span>
              <span className={styles.goalValue}>
                {formatMoney(monthlyRevenue)} of {formatMoney(expectedRevenue)}
              </span>
            </div>
            <div className={styles.goalTrack}>
              <div
                className={styles.goalFill}
                style={{ width: `${revenueGoalPercent ?? 0}%` }}
              />
            </div>
            <p className={styles.goalPercent}>
              {revenueGoalPercent != null && revenueGoalPercent >= 100
                ? "Goal reached!"
                : revenueGoalPercent != null
                  ? `${revenueGoalPercent}% there`
                  : ''}
            </p>
          </section>
        )}

        {/* Work hours this week – chart */}
        <section className={styles.chartSection}>
          <h3 className={styles.sectionTitle}>Work hours this week</h3>
          <div className={styles.chartCard}>
            {weekChartData.length === 0 && !hoursLoading ? (
              <p className={styles.chartEmpty}>No work blocks this week yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weekChartData} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} unit="h" />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                    }}
                    labelStyle={{ color: 'var(--text-muted)' }}
                    formatter={(value: number | undefined) => [value != null ? `${Number(value).toFixed(1)}h` : '', 'Work']}
                    labelFormatter={(_, payload) => payload[0]?.payload?.label ?? ''}
                  />
                  <Bar dataKey="hours" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Two columns: Recent time blocks + Recent revenue */}
        <section className={styles.recentSection}>
          <div className={styles.recentColumn}>
            <div className={styles.recentHeader}>
              <h3 className={styles.sectionTitle}>Recent time blocks</h3>
              <Link to="/time-record" className={styles.viewAllLink}>View all →</Link>
            </div>
            <div className={styles.recentCard}>
              {recentBlocks.length === 0 && !hoursLoading ? (
                <p className={styles.recentEmpty}>No time blocks yet. <Link to="/time-record">Log time</Link>.</p>
              ) : (
                <ul className={styles.recentList}>
                  {recentBlocks.map((b) => {
                    const { title } = parseSummary(b.summary);
                    const label = BLOCK_TITLES[title] ?? title;
                    const start = new Date(b.startAt);
                    const end = new Date(b.endAt);
                    const dateStr = formatDateTimeInAppTz(start, { month: 'short', day: 'numeric' });
                    const timeStr = `${formatDateTimeInAppTz(start, { hour: 'numeric', minute: '2-digit' })} – ${formatDateTimeInAppTz(end, { hour: 'numeric', minute: '2-digit' })}`;
                    return (
                      <li key={b.id} className={styles.recentItem}>
                        <span className={styles.recentItemType}>{label}</span>
                        <span className={styles.recentItemMeta}>{dateStr} · {timeStr}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
          <div className={styles.recentColumn}>
            <div className={styles.recentHeader}>
              <h3 className={styles.sectionTitle}>Recent revenue</h3>
              <Link to="/revenue" className={styles.viewAllLink}>View all →</Link>
            </div>
            <div className={styles.recentCard}>
              {recentEntries.length === 0 && !revenueLoading ? (
                <p className={styles.recentEmpty}>No revenue entries yet. <Link to="/revenue">Add revenue</Link>.</p>
              ) : (
                <ul className={styles.recentList}>
                  {recentEntries.map((e) => (
                    <li key={e.id} className={styles.recentItem}>
                      <span className={e.amount < 0 ? styles.recentItemAmountNegative : styles.recentItemAmount}>
                        {formatMoney(e.amount)}
                      </span>
                      <span className={styles.recentItemMeta}>
                        {e.date} {e.note ? `· ${e.note}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Your position */}
        <section className={styles.rankSection}>
          <h3 className={styles.sectionTitle}>Your position</h3>
          <div className={styles.rankCards}>
            <Link to="/rankings" className={styles.rankCard}>
              <span className={styles.rankCardLabel}>Work hours</span>
              <span className={styles.rankCardValue}>
                {rankingsLoading ? '…' : workRank != null ? `#${workRank}` : '—'}
              </span>
              <span className={styles.rankCardSub}>See full rankings</span>
            </Link>
            <Link to="/rankings" className={styles.rankCard}>
              <span className={styles.rankCardLabel}>Revenue</span>
              <span className={styles.rankCardValue}>
                {rankingsLoading ? '…' : revenueRank != null ? `#${revenueRank}` : '—'}
              </span>
              <span className={styles.rankCardSub}>See full rankings</span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
