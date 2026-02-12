import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import momentTimezonePlugin from '@fullcalendar/moment-timezone';
import type { DatesSetArg, EventClickArg, EventContentArg, EventDropArg, DateSelectArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { timeBlocksApi, parseSummary } from '../../api/client';
import {
  dateInAppTzToUTC,
  formatDateTimeInAppTz,
  getMonthEndISO,
  getMonthStartISO,
  getTodayEndISO,
  getTodayStartISO,
  getWeekEndISO,
  getWeekStartISO,
} from '../../utils/datetime';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../../components/ThemeToggle';
import EditBlockModal from './EditBlockModal';
import styles from './TimeRecord.module.css';

type CalendarEvent = { id: string; title: string; start: string; end: string; extendedProps?: { summary: string | null; content: string | null } };

function formatHours(ms: number): string {
  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function TimeRecord() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const calendarRef = useRef<FullCalendar>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editBlock, setEditBlock] = useState<{ id: string; start: string; end: string; summary: string | null; content: string | null } | null>(null);
  const [newlyCreatedBlock, setNewlyCreatedBlock] = useState<{ id: string; start: string; end: string; summary: string | null; content: string | null } | null>(null);
  const [pendingNewBlockId, setPendingNewBlockId] = useState<string | null>(null);
  const [viewRange, setViewRange] = useState<{ start: Date; end: Date } | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEventIdRef = useRef<string | null>(null);
  selectedEventIdRef.current = selectedEventId;
  const eventsRef = useRef<CalendarEvent[]>([]);
  eventsRef.current = events;

  const fetchEvents = useCallback(async (start: Date, end: Date) => {
    setLoading(true);
    setError('');
    try {
      const blocks = await timeBlocksApi.list(start.toISOString(), end.toISOString());
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
  }, []);

  const refetch = useCallback(() => {
    if (viewRange) fetchEvents(viewRange.start, viewRange.end);
  }, [viewRange, fetchEvents]);

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

  const handleSelectAllow = useCallback(
    (span: { start: Date; end: Date }, _movingEvent: unknown) => {
      const evs = eventsRef.current;
      const selStart = span.start.getTime();
      const selEnd = span.end.getTime();
      for (const e of evs) {
        const s = new Date(e.start).getTime();
        const end = new Date(e.end).getTime();
        if (selStart < end && selEnd > s) return false;
      }
      return true;
    },
    []
  );

  const handleSelect = useCallback(
    async (arg: DateSelectArg) => {
      setError('');
      setNewlyCreatedBlock(null);
      const selStartStr = dateInAppTzToUTC(arg.start);
      const selEndStr = dateInAppTzToUTC(arg.end);

      try {
        const created = await timeBlocksApi.create(selStartStr, selEndStr);
        refetch();
        const { title: summaryTitle, content } = parseSummary(created.summary);
        const block = {
          id: created.id,
          start: created.startAt,
          end: created.endAt,
          summary: summaryTitle,
          content,
        };
        setNewlyCreatedBlock(block);
        setEditBlock(block);
        setPendingNewBlockId(created.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create block');
      }
    },
    [refetch]
  );

  const handleEventDrop = useCallback(
    async (arg: EventDropArg) => {
      const evs = eventsRef.current;
      const newStart = arg.event.start!.getTime();
      const newEnd = arg.event.end!.getTime();
      const movingId = arg.event.id;

      for (const e of evs) {
        if (e.id === movingId) continue;
        const s = new Date(e.start).getTime();
        const end = new Date(e.end).getTime();
        if (newStart < end && newEnd > s) {
          arg.revert();
          return;
        }
      }

      setError('');
      try {
        await timeBlocksApi.update(arg.event.id, {
          startAt: dateInAppTzToUTC(arg.event.start!),
          endAt: dateInAppTzToUTC(arg.event.end!),
        });
      } catch (e) {
        arg.revert();
        setError(e instanceof Error ? e.message : 'Failed to move');
      }
    },
    []
  );

  const handleEventResize = useCallback(
    async (arg: EventResizeDoneArg) => {
      const evs = eventsRef.current;
      const newStart = arg.event.start!.getTime();
      const newEnd = arg.event.end!.getTime();
      const resizingId = arg.event.id;

      for (const e of evs) {
        if (e.id === resizingId) continue;
        const s = new Date(e.start).getTime();
        const end = new Date(e.end).getTime();
        if (newStart < end && newEnd > s) {
          arg.revert();
          return;
        }
      }

      setError('');
      try {
        await timeBlocksApi.update(arg.event.id, {
          startAt: dateInAppTzToUTC(arg.event.start!),
          endAt: dateInAppTzToUTC(arg.event.end!),
        });
      } catch (e) {
        arg.revert();
        setError(e instanceof Error ? e.message : 'Failed to resize');
      }
    },
    []
  );

  const handleEventClick = useCallback((arg: EventClickArg) => {
    arg.jsEvent.preventDefault();
    // Prefer our events state so we have summary + content; FullCalendar may not preserve extendedProps
    const ourEvent = eventsRef.current.find((e) => e.id === arg.event.id);
    const ext = ourEvent?.extendedProps ?? (arg.event.extendedProps as { summary?: string | null; content?: string | null });
    setSelectedEventId(arg.event.id);
    setEditBlock({
      id: arg.event.id,
      start: arg.event.start!.toISOString(),
      end: arg.event.end!.toISOString(),
      summary: ext?.summary ?? arg.event.title ?? null,
      content: ext?.content ?? null,
    });
  }, []);

  const handleEditSaved = useCallback(() => {
    setEditBlock(null);
    setSelectedEventId(null);
    setNewlyCreatedBlock(null);
    setPendingNewBlockId(null);
    refetch();
  }, [refetch]);

  const handleEditCancel = useCallback(async () => {
    const blockId = editBlock?.id;
    const shouldRemoveNewBlock = blockId && blockId === pendingNewBlockId;
    setEditBlock(null);
    setSelectedEventId(null);
    setNewlyCreatedBlock(null);
    setPendingNewBlockId(null);
    if (shouldRemoveNewBlock) {
      try {
        await timeBlocksApi.delete(blockId);
      } catch {
        // ignore
      }
    }
    refetch();
  }, [refetch, editBlock?.id, pendingNewBlockId]);

  const handleOpenNewBlockDetails = useCallback(() => {
    if (newlyCreatedBlock) {
      setEditBlock(newlyCreatedBlock);
      setNewlyCreatedBlock(null);
    }
  }, [newlyCreatedBlock]);

  // Summaries from current events in view (approximate for visible range)
  const todayStart = new Date(getTodayStartISO());
  const todayEnd = new Date(getTodayEndISO());
  const weekStart = new Date(getWeekStartISO());
  const weekEnd = new Date(getWeekEndISO());
  const monthStart = new Date(getMonthStartISO());
  const monthEnd = new Date(getMonthEndISO());

  const toMs = (s: string) => new Date(s).getTime();
  const workEventsOnly = (list: typeof events) => list.filter((e) => e.title === 'Work');
  const dailyMs = workEventsOnly(events)
    .filter((e) => toMs(e.end) > todayStart.getTime() && toMs(e.start) < todayEnd.getTime())
    .reduce((sum, e) => sum + Math.min(toMs(e.end), todayEnd.getTime()) - Math.max(toMs(e.start), todayStart.getTime()), 0);
  const weeklyMs = workEventsOnly(events)
    .filter((e) => toMs(e.end) > weekStart.getTime() && toMs(e.start) < weekEnd.getTime())
    .reduce((sum, e) => sum + Math.min(toMs(e.end), weekEnd.getTime()) - Math.max(toMs(e.start), weekStart.getTime()), 0);
  const monthlyMs = workEventsOnly(events)
    .filter((e) => toMs(e.end) > monthStart.getTime() && toMs(e.start) < monthEnd.getTime())
    .reduce((sum, e) => sum + Math.min(toMs(e.end), monthEnd.getTime()) - Math.max(toMs(e.start), monthStart.getTime()), 0);

  const name = user?.display_name || user?.email || 'Member';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>PYCE Portal</h1>
        <nav className={styles.nav}>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/time-record" className={styles.navActive}>Time Record</Link>
          <Link to="/revenue">Revenue</Link>
          <Link to="/rankings">Rankings</Link>
          {user?.role === 'admin' && <Link to="/admin" className={styles.adminLink}>Admin</Link>}
          <ThemeToggle />
          <span className={styles.user}>{name}</span>
          <button type="button" onClick={() => { logout(); navigate('/signin', { replace: true }); }} className={styles.logoutBtn}>Sign out</button>
        </nav>
      </header>
      <main className={styles.main}>
        <div className={styles.toolbar}>
          <h2>Time Record</h2>
          {error && <div className={styles.error}>{error}</div>}
          {loading && <span className={styles.loading}>Loading…</span>}
        </div>
        <div className={styles.calendarWrap}>
          <FullCalendar
            ref={calendarRef}
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
            editable
            selectable
            selectMirror
            dayMaxEvents={false}
            eventOverlap={false}
            eventAllow={(span, movingEvent) => {
              const evs = eventsRef.current;
              const newStart = span.start.getTime();
              const newEnd = span.end.getTime();
              const movingId = movingEvent?.id ?? null;
              for (const e of evs) {
                if (e.id === movingId) continue;
                const s = new Date(e.start).getTime();
                const end = new Date(e.end).getTime();
                if (newStart < end && newEnd > s) return false;
              }
              return true;
            }}
            events={events}
            datesSet={handleDatesSet}
            selectAllow={handleSelectAllow}
            select={handleSelect}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventClick={handleEventClick}
            eventContent={(arg: EventContentArg) => {
              const fromCalendar = arg.event.extendedProps as { summary?: string | null; content?: string | null } | undefined;
              const fromOurState = eventsRef.current.find((e) => e.id === arg.event.id)?.extendedProps?.content;
              const content = (fromOurState ?? fromCalendar?.content ?? '').trim();
              const start = arg.event.start ? formatDateTimeInAppTz(arg.event.start, { hour: 'numeric', minute: '2-digit' }) : arg.timeText;
              return (
                <div className={styles.eventContent}>
                  <span className={styles.eventTime}>
                    {start}
                  </span>
                  <span className={styles.eventTitle}>{arg.event.title}</span>
                  {content ? (
                    <span className={styles.eventBlockContent}>{content}</span>
                  ) : null}
                </div>
              );
            }}
            height="auto"
          />
          {newlyCreatedBlock && (
            <div className={styles.newBlockActions}>
              <button type="button" className={styles.addDetailsBtn} onClick={handleOpenNewBlockDetails}>
                Add details to new block
              </button>
            </div>
          )}
        </div>
        <aside className={styles.summaries}>
          <h3>Working summary</h3>
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
          <p className={styles.hint}>Drag on the calendar to create a block. Drag events to move, drag edges to resize. Click an event to edit or delete.</p>
        </aside>
      </main>
      {editBlock && (
        <EditBlockModal
          key={editBlock.id}
          id={editBlock.id}
          start={editBlock.start}
          end={editBlock.end}
          summary={editBlock.summary}
          content={editBlock.content}
          onClose={handleEditCancel}
          onSaved={handleEditSaved}
        />
      )}
    </div>
  );
}
