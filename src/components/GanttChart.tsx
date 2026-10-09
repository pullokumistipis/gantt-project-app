import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useProject } from '../state/ProjectContext';
import type { Task } from '../types';
import {
  addDays,
  dateToIndex,
  dayDiff,
  formatDateID,
  indexToDate,
  isHoliday,
  isWorkingDay,
  lastWorkingIndexOnOrBefore,
  startOfMonth,
  startOfNextMonth,
  formatMonthShort,
  formatMonthYear,
  todayISO,
} from '../utils/dates';

const ROW_H = 34;
const MONTH_H = 28;
const DAY_H = 26;
const HEAD_H = MONTH_H + DAY_H;

type ZoomKey = 'hari' | 'pekan' | 'bulan';

const PX: Record<ZoomKey, number> = { hari: 40, pekan: 24, bulan: 12 };
const ZOOM_LABEL: Record<ZoomKey, string> = { hari: 'Harian', pekan: 'Pekan', bulan: 'Bulan' };
const ZOOM_KEYS: ZoomKey[] = ['hari', 'pekan', 'bulan'];
const DAY_INITIALS = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];

interface DragOrigin {
  mode: 'move' | 'resize-start' | 'resize-end';
  taskId: string;
  pointerX: number;
  startDate: string;
  duration: number;
}

interface Preview {
  taskId: string;
  startDate: string;
  duration: number;
}

interface BarBox {
  left: number;
  width: number;
  start: string;
  finish: string;
  duration: number;
}

export function GanttChart() {
  const { data, schedule, rows, selectedTaskId, selectTask, updateTask, toggleCollapse } = useProject();
  const [zoom, setZoom] = useState<ZoomKey>('hari');
  const [showCritical, setShowCritical] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const dragRef = useRef<DragOrigin | null>(null);
  const previewRef = useRef<Preview | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const cal = data.calendar;
  const pxPerDay = PX[zoom];
  const leftW = useMemo(() => (typeof window !== 'undefined' && window.innerWidth < 700 ? 180 : 300), []);
  const today = todayISO();

  const { rangeStart, rangeEnd, totalDays, timelineWidth } = useMemo(() => {
    let min = data.project.startDate;
    let max = data.project.startDate;
    for (const row of rows) {
      const item = schedule.items[row.task.id];
      if (!item) continue;
      if (item.start < min) min = item.start;
      if (item.finish > max) max = item.finish;
    }
    if (schedule.projectStart < min) min = schedule.projectStart;
    if (schedule.projectFinish > max) max = schedule.projectFinish;
    const start = addDays(min, -4);
    const end = addDays(max, 12);
    const days = Math.max(14, dayDiff(start, end));
    return { rangeStart: start, rangeEnd: end, totalDays: days, timelineWidth: days * pxPerDay };
  }, [rows, schedule, data.project.startDate, pxPerDay]);

  const days = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i)),
    [rangeStart, totalDays],
  );

  const months = useMemo(() => {
    const list: { key: string; left: number; width: number; label: string; short: string }[] = [];
    let cursor = startOfMonth(rangeStart);
    while (cursor < rangeEnd) {
      const next = startOfNextMonth(cursor);
      const from = Math.max(0, dayDiff(rangeStart, cursor));
      const to = Math.min(totalDays, dayDiff(rangeStart, next));
      if (to > from) {
        list.push({
          key: cursor,
          left: from * pxPerDay,
          width: (to - from) * pxPerDay,
          label: formatMonthYear(cursor),
          short: formatMonthShort(cursor),
        });
      }
      cursor = next;
    }
    return list;
  }, [rangeStart, rangeEnd, totalDays, pxPerDay]);

  const bars = useMemo(() => {
    const map: Record<string, BarBox> = {};
    for (const row of rows) {
      const item = schedule.items[row.task.id];
      if (!item) continue;
      let start = item.start;
      let duration = item.duration;
      if (preview && preview.taskId === row.task.id) {
        start = preview.startDate;
        duration = preview.duration;
      }
      const startIndex = dateToIndex(start, cal);
      const finish = indexToDate(startIndex + Math.max(1, duration) - 1, cal);
      const from = dayDiff(rangeStart, start);
      const to = dayDiff(rangeStart, finish);
      map[row.task.id] = {
        left: from * pxPerDay,
        width: Math.max(pxPerDay, (to - from + 1) * pxPerDay),
        start,
        finish,
        duration,
      };
    }
    return map;
  }, [rows, schedule, preview, cal, rangeStart, pxPerDay]);

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row, index) => map.set(row.task.id, index));
    return map;
  }, [rows]);

  const arrows = useMemo(() => {
    const list: { key: string; d: string; state: 'critical' | 'selected' | 'normal' }[] = [];
    const yOf = (index: number) => index * ROW_H + ROW_H / 2;
    for (const row of rows) {
      const targetId = row.task.id;
      const targetBox = bars[targetId];
      const targetIndex = rowIndexById.get(targetId);
      if (!targetBox || targetIndex === undefined) continue;
      for (const dep of row.task.dependencies) {
        if (dep.taskId === targetId) continue;
        const sourceBox = bars[dep.taskId];
        const sourceIndex = rowIndexById.get(dep.taskId);
        if (!sourceBox || sourceIndex === undefined) continue;
        const sx = dep.type === 'FS' ? sourceBox.left + sourceBox.width : sourceBox.left;
        const sy = yOf(sourceIndex);
        const tx = targetBox.left;
        const ty = yOf(targetIndex);
        const ex = dep.type === 'FS' ? sx + 10 : sx - 10;
        const back = Math.min(ex, tx - 14);
        const d = `M ${sx} ${sy} H ${ex} V ${ty} H ${back} H ${tx}`;
        const critical =
          showCritical && schedule.items[dep.taskId]?.critical && schedule.items[targetId]?.critical;
        const selected = selectedTaskId === targetId || selectedTaskId === dep.taskId;
        list.push({
          key: `${targetId}:${dep.taskId}:${dep.type}`,
          d,
          state: critical ? 'critical' : selected ? 'selected' : 'normal',
        });
      }
    }
    return list;
  }, [rows, bars, rowIndexById, showCritical, schedule, selectedTaskId]);

  const rowsH = rows.length * ROW_H;
  const todayOffset = dayDiff(rangeStart, today);
  const todayVisible = todayOffset >= 0 && todayOffset < totalDays;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const first = rows[0] ? schedule.items[rows[0].task.id] : undefined;
    const x = first ? dayDiff(rangeStart, first.start) * pxPerDay : 0;
    el.scrollLeft = Math.max(0, x - 60);
    // mount-only: jump to the beginning of the plan
  }, []);

  const contentX = (clientX: number): number => {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return clientX - rect.left + el.scrollLeft - leftW;
  };

  const beginDrag = (event: ReactPointerEvent, task: Task, mode: DragOrigin['mode']) => {
    if (event.button !== 0) return;
    const item = schedule.items[task.id];
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    const el = event.currentTarget as HTMLElement;
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      // pointer capture unsupported — drag still works within the element
    }
    dragRef.current = {
      mode,
      taskId: task.id,
      pointerX: event.clientX,
      startDate: item.start,
      duration: item.duration,
    };
    previewRef.current = null;
    setPreview(null);
    selectTask(task.id);
  };

  const handleDragMove = (event: ReactPointerEvent) => {
    const origin = dragRef.current;
    if (!origin) return;
    let next: Preview | null = null;

    if (origin.mode === 'move') {
      const dx = event.clientX - origin.pointerX;
      const target = addDays(origin.startDate, Math.round(dx / pxPerDay));
      const idx = Math.max(0, lastWorkingIndexOnOrBefore(target, cal));
      next = { taskId: origin.taskId, startDate: indexToDate(idx, cal), duration: origin.duration };
    } else {
      const col = Math.floor(contentX(event.clientX) / pxPerDay);
      const target = addDays(rangeStart, col);
      const originStartIdx = dateToIndex(origin.startDate, cal);
      if (origin.mode === 'resize-end') {
        const endIdx = Math.max(originStartIdx, lastWorkingIndexOnOrBefore(target, cal));
        next = {
          taskId: origin.taskId,
          startDate: origin.startDate,
          duration: endIdx - originStartIdx + 1,
        };
      } else {
        const finishIdx = originStartIdx + origin.duration - 1;
        const startIdx = Math.min(finishIdx, Math.max(0, lastWorkingIndexOnOrBefore(target, cal)));
        next = {
          taskId: origin.taskId,
          startDate: indexToDate(startIdx, cal),
          duration: finishIdx - startIdx + 1,
        };
      }
    }

    previewRef.current = next;
    setPreview(next);
  };

  const handleDragEnd = (event: ReactPointerEvent) => {
    const origin = dragRef.current;
    const next = previewRef.current;
    dragRef.current = null;
    previewRef.current = null;
    setPreview(null);
    const el = event.currentTarget as HTMLElement;
    try {
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    if (origin && next && next.taskId === origin.taskId) {
      if (next.startDate !== origin.startDate || next.duration !== origin.duration) {
        updateTask(origin.taskId, { startDate: next.startDate, duration: next.duration });
      }
    }
  };

  const dragProps = (task: Task, mode: DragOrigin['mode']) => ({
    onPointerDown: (event: ReactPointerEvent) => beginDrag(event, task, mode),
    onPointerMove: handleDragMove,
    onPointerUp: handleDragEnd,
    onPointerCancel: handleDragEnd,
  });

  const scrollToToday = () => {
    const el = scrollRef.current;
    if (!el) return;
    const x = dayDiff(rangeStart, today) * pxPerDay;
    el.scrollLeft = Math.max(0, x - 140);
  };

  const dayClass = (iso: string) => {
    const cls: string[] = [];
    if (!isWorkingDay(iso, cal)) cls.push(isHoliday(iso, cal) ? 'is-holiday' : 'is-weekend');
    if (iso === today) cls.push('is-today');
    return cls.join(' ');
  };

  return (
    <section className="panel panel-gantt">
      <header className="panel-head">
        <div>
          <h2>Gantt Chart</h2>
          <p className="muted">
            {formatDateID(rangeStart)} — {formatDateID(rangeEnd)} · {rows.length} baris · seret bar untuk
            memindahkan, tarik tepi bar untuk ubah durasi
          </p>
        </div>
        <div className="panel-actions">
          <div className="seg" role="group" aria-label="Skala waktu">
            {ZOOM_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`seg-btn${zoom === key ? ' is-active' : ''}`}
                onClick={() => setZoom(key)}
              >
                {ZOOM_LABEL[key]}
              </button>
            ))}
          </div>
          <label className="check-inline">
            <input
              type="checkbox"
              checked={showCritical}
              onChange={(e) => setShowCritical(e.target.checked)}
            />
            Sorot jalur kritis
          </label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={scrollToToday}>
            Hari ini
          </button>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="empty-state">Belum ada tugas. Tambahkan tugas pertama pada tab “Tugas”.</p>
      ) : (
        <div className="gantt-scroll" ref={scrollRef}>
          <div className="gantt-inner" style={{ width: leftW + timelineWidth }}>
            <div className="gantt-head" style={{ height: HEAD_H }}>
              <div className="gantt-head-left" style={{ width: leftW }}>
                <span>Tugas</span>
              </div>
              <div className="gantt-head-right" style={{ width: timelineWidth }}>
                <div className="gantt-months" style={{ height: MONTH_H }}>
                  {months.map((month) => (
                    <div
                      key={month.key}
                      className="gantt-month"
                      style={{ left: month.left, width: month.width }}
                    >
                      {month.width >= 90 ? month.label : month.short}
                    </div>
                  ))}
                </div>
                <div className="gantt-days" style={{ height: DAY_H }}>
                  {days.map((iso, i) => {
                    const date = new Date(`${iso}T00:00:00.000Z`);
                    return (
                      <div
                        key={iso}
                        className={`gantt-day ${dayClass(iso)}`}
                        style={{ left: i * pxPerDay, width: pxPerDay }}
                        title={formatDateID(iso)}
                      >
                        {pxPerDay >= 32 ? (
                          <span className="day-initial">{DAY_INITIALS[date.getUTCDay()]}</span>
                        ) : null}
                        {pxPerDay >= 26 ? date.getUTCDate() : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              className="gantt-columns"
              style={{ left: leftW, top: HEAD_H, width: timelineWidth, height: rowsH }}
              aria-hidden="true"
            >
              {days.map((iso, i) => (
                <div
                  key={iso}
                  className={`gantt-col ${dayClass(iso)}`}
                  style={{ left: i * pxPerDay, width: pxPerDay }}
                />
              ))}
              {todayVisible ? (
                <div className="gantt-today-line" style={{ left: todayOffset * pxPerDay }} />
              ) : null}
            </div>

            {rows.map((row, index) => {
              const task = row.task;
              const box = bars[task.id];
              const item = schedule.items[task.id];
              const isPreview = preview?.taskId === task.id;
              const critical = showCritical && item?.critical;
              const selected = selectedTaskId === task.id;
              return (
                <div
                  key={task.id}
                  className={`gantt-row${index % 2 === 1 ? ' is-alt' : ''}${selected ? ' is-selected' : ''}`}
                  style={{ height: ROW_H }}
                >
                  <div
                    className="gantt-row-left"
                    style={{ width: leftW }}
                    onClick={() => selectTask(task.id)}
                  >
                    <button
                      type="button"
                      className={`caret${row.hasChildren ? '' : ' is-hidden'}`}
                      aria-label={task.collapsed ? 'Buka sub-tugas' : 'Tutup sub-tugas'}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (row.hasChildren) toggleCollapse(task.id);
                      }}
                    >
                      {task.collapsed ? '▸' : '▾'}
                    </button>
                    <span className="dot" style={{ backgroundColor: task.color }} />
                    <span className="task-name" title={task.name} style={{ marginLeft: row.depth * 14 }}>
                      {task.name}
                    </span>
                    {critical ? <span className="crit-mark">KP</span> : null}
                  </div>
                  <div className="gantt-row-right" style={{ width: timelineWidth }}>
                    {box ? (
                      <div
                        className={`gantt-bar${critical ? ' is-critical' : ''}${
                          selected ? ' is-selected' : ''
                        }${isPreview ? ' is-dragging' : ''}`}
                        style={{ left: box.left, width: box.width, backgroundColor: task.color }}
                        title={`${task.name}\n${formatDateID(box.start)} → ${formatDateID(
                          box.finish,
                        )} · ${box.duration} hari kerja`}
                        {...dragProps(task, 'move')}
                      >
                        <div className="gantt-bar-progress" style={{ width: `${task.progress}%` }} />
                        {box.width >= 78 ? <span className="gantt-bar-label">{task.name}</span> : null}
                        <span
                          className="gantt-handle is-start"
                          aria-hidden="true"
                          title="Ubah tanggal mulai"
                          {...dragProps(task, 'resize-start')}
                        />
                        <span
                          className="gantt-handle is-end"
                          aria-hidden="true"
                          title="Ubah durasi"
                          {...dragProps(task, 'resize-end')}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            <svg
              className="gantt-arrows"
              width={timelineWidth}
              height={rowsH}
              style={{ left: leftW, top: HEAD_H }}
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="arrow-normal"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
                </marker>
                <marker
                  id="arrow-critical"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M0,0 L10,5 L0,10 z" fill="#dc2626" />
                </marker>
                <marker
                  id="arrow-selected"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M0,0 L10,5 L0,10 z" fill="#4f46e5" />
                </marker>
              </defs>
              {arrows.map((arrow) => (
                <path
                  key={arrow.key}
                  d={arrow.d}
                  className={`gantt-dep-path is-${arrow.state}`}
                  fill="none"
                  markerEnd={`url(#arrow-${arrow.state})`}
                />
              ))}
            </svg>
          </div>
        </div>
      )}
    </section>
  );
}
