import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import momentTimezonePlugin from '@fullcalendar/moment-timezone';
import type { DatesSetArg, EventContentArg } from '@fullcalendar/core';
import { adminApi, timeBlocksApi, parseSummary } from '../../api/client';
import {
  formatDateTimeInAppTz,
  getMonthEndISO,
  getMonthStartISO,
  getTodayEndISO,
  getTodayStartISO,
  getWeekEndISO,
  getWeekStartISO,
} from '../../utils/datetime';
import type { AdminMember } from '../../api/client';

export type MembersFetcher = () => Promise<AdminMember[]>;
import styles from './Admin.module.css';
import calendarStyles from '../time-record/TimeRecord.module.css';

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  extendedProps?: { summary: string | null; content: string | null };
  classNames?: string[];
};

function formatHours(ms: number): string {
  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface AdminTimeSheetsProps {
  /** When provided (e.g. on team-time page), use this instead of admin API so any user can load members */
  membersFetcher?: MembersFetcher;
  /** When true (e.g. team-time page), layout fills viewport and calendar/summaries are larger */
  fullPage?: boolean;
}

export default function AdminTimeSheets({ membersFetcher, fullPage }: AdminTimeSheetsProps = {}) {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewRange, setViewRange] = useState<{ start: Date; end: Date } | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{ title: string; content: string; left: number; top: number } | null>(null);
  const eventsRef = useRef<CalendarEvent[]>([]);
  eventsRef.current = events;

  const fetchMembers = useMemo(
    () => membersFetcher ?? (() => adminApi.listMembers()),
    [membersFetcher]
  );

  useEffect(() => {
    fetchMembers()
      .then((list) => {
        setMembers(list);
        if (list.length > 0) setSelectedUserId((prev) => prev || list[0].id);
      })
      .catch(() => setMembers([]));
  }, [fetchMembers]);

  const fetchEvents = useCallback(
    async (start: Date, end: Date) => {
      if (!selectedUserId) {
        setEvents([]);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const blocks = await timeBlocksApi.list(start.toISOString(), end.toISOString(), selectedUserId);
        setEvents(
          blocks.map((b) => {
            const { title: summaryTitle, content } = parseSummary(b.summary);
            const type = ['Work', 'Sleep', 'Idle', 'Absent'].includes(summaryTitle) ? summaryTitle : 'Work';
            return {
              id: b.id,
              title: summaryTitle,
              start: b.startAt,
              end: b.endAt,
              extendedProps: { summary: summaryTitle, content },
              classNames: [`event-${type.toLowerCase()}`],
            };
          })
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setEvents([]);
      } finally {
        setLoading(false);
      }
    },
    [selectedUserId]
  );

  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      setViewRange({ start: arg.start, end: arg.end });
      const monthStart = new Date(getMonthStartISO());
      const monthEnd = new Date(getMonthEndISO());
      const fetchStart = arg.start < monthStart ? arg.start : monthStart;
      const fetchEnd = arg.end > monthEnd ? arg.end : monthEnd;
      fetchEvents(fetchStart, fetchEnd);
    },
    [fetchEvents]
  );

  useEffect(() => {
    if (!selectedUserId || !viewRange) return;
    fetchEvents(viewRange.start, viewRange.end);
  }, [selectedUserId]); // eslint-disable-line react-hooks/exhaustive-deps -- refetch when member changes only

  const todayStart = new Date(getTodayStartISO());
  const todayEnd = new Date(getTodayEndISO());
  const weekStart = new Date(getWeekStartISO());
  const weekEnd = new Date(getWeekEndISO());
  const monthStart = new Date(getMonthStartISO());
  const monthEnd = new Date(getMonthEndISO());
  const toMs = (s: string) => new Date(s).getTime();
  const workEventsOnly = (list: CalendarEvent[]) => list.filter((e) => e.title === 'Work');
  // Same calculation as Time Record page: filter to events overlapping the period, then sum only the overlapping portion
  const dailyMs = workEventsOnly(events)
    .filter((e) => toMs(e.end) > todayStart.getTime() && toMs(e.start) < todayEnd.getTime())
    .reduce((sum, e) => sum + Math.min(toMs(e.end), todayEnd.getTime()) - Math.max(toMs(e.start), todayStart.getTime()), 0);
  const weeklyMs = workEventsOnly(events)
    .filter((e) => toMs(e.end) > weekStart.getTime() && toMs(e.start) < weekEnd.getTime())
    .reduce((sum, e) => sum + Math.min(toMs(e.end), weekEnd.getTime()) - Math.max(toMs(e.start), weekStart.getTime()), 0);
  const monthlyMs = workEventsOnly(events)
    .filter((e) => toMs(e.end) > monthStart.getTime() && toMs(e.start) < monthEnd.getTime())
    .reduce((sum, e) => sum + Math.min(toMs(e.end), monthEnd.getTime()) - Math.max(toMs(e.start), monthStart.getTime()), 0);

  const selectedMember = members.find((m) => m.id === selectedUserId);

  const content = (
    <>
      <header className={styles.pageHeader}>
        <h1>Time sheets</h1>
        <p className={styles.pageSub}>View any member&apos;s time blocks (same time period as user page).</p>
      </header>
      <div className={styles.toolbar}>
        <label className={styles.selectLabel}>
          Member
          <select
            value={selectedUserId ?? ''}
            onChange={(e) => setSelectedUserId(e.target.value || null)}
            className={styles.select}
          >
            {members.length === 0 && <option value="">No members</option>}
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </label>
        {error && <div className={styles.error}>{error}</div>}
        {loading && <span className={styles.loading}>Loading…</span>}
      </div>
      <div className={styles.gridWithSidebar}>
        <div className={styles.calendarWrap}>
          {selectedUserId ? (
            <FullCalendar
              plugins={[momentTimezonePlugin, dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              timeZone="Asia/Yakutsk"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }}
              slotMinTime="08:00:00"
              slotMaxTime="32:00:00"
              allDaySlot={false}
              nowIndicator
              editable={false}
              selectable={false}
              dayMaxEvents={false}
              events={events}
              datesSet={handleDatesSet}
              eventContent={(arg: EventContentArg) => {
                const fromOurState = eventsRef.current.find((e) => e.id === arg.event.id)?.extendedProps?.content;
                const fromCalendar = arg.event.extendedProps as { content?: string } | undefined;
                const content = (fromOurState ?? fromCalendar?.content ?? '').trim();
                const previewTitle = arg.event.title || arg.timeText;
                const previewContent = content || '(no description)';
                return (
                  <div
                    className={styles.eventWithTooltip}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoverPreview({
                        title: previewTitle,
                        content: previewContent,
                        left: rect.right + 8,
                        top: rect.top,
                      });
                    }}
                    onMouseLeave={() => setHoverPreview(null)}
                  >
                    <div className={calendarStyles.eventContent}>
                      <span className={calendarStyles.eventTime}>
                      {arg.event.start ? formatDateTimeInAppTz(arg.event.start, { hour: 'numeric', minute: '2-digit' }) : arg.timeText}
                    </span>
                      <span className={calendarStyles.eventTitle}>{arg.event.title}</span>
                      {content ? (
                        <span className={calendarStyles.eventBlockContent}>{content}</span>
                      ) : null}
                    </div>
                  </div>
                );
              }}
              height="auto"
            />
          ) : (
            <p className={styles.placeholder}>Select a member to view their time sheets.</p>
          )}
        </div>
        <aside className={styles.summaries}>
          <h3>Work summary {selectedMember ? `— ${selectedMember.displayName}` : ''}</h3>
          <div className={styles.summaryCards}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Today</span>
              <span className={styles.summaryValue}>{formatHours(dailyMs)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>This week</span>
              <span className={styles.summaryValue}>{formatHours(weeklyMs)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>This month</span>
              <span className={styles.summaryValue}>{formatHours(monthlyMs)}</span>
            </div>
          </div>
        </aside>
      </div>
      {hoverPreview &&
        createPortal(
          <div
            className={`${styles.eventTooltip} ${styles.eventTooltipPortal}`}
            style={{ position: 'fixed', left: hoverPreview.left, top: hoverPreview.top }}
            role="tooltip"
          >
            <div className={styles.eventTooltipTitle}>{hoverPreview.title}</div>
            <div className={styles.eventTooltipContent}>{hoverPreview.content}</div>
          </div>,
          document.body
        )}
    </>
  );

  return fullPage ? <div className={styles.fullPageContent}>{content}</div> : content;
}
