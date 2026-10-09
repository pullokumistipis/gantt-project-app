import { useMemo, useState, type FormEvent } from 'react';
import { useProject } from '../state/ProjectContext';
import {
  addDays,
  dayDiff,
  formatDateID,
  formatFullDateID,
  isValidISO,
  weekdayName,
  workingDaysInclusive,
} from '../utils/dates';
import { Field } from './common';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export function CalendarView() {
  const { data, schedule, addHoliday, removeHoliday, setWeekendDays } = useProject();
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cal = data.calendar;

  const stats = useMemo(() => {
    let min = data.project.startDate;
    let max = data.project.startDate;
    for (const row of Object.values(schedule.items)) {
      if (row.start < min) min = row.start;
      if (row.finish > max) max = row.finish;
    }
    const first = addDays(min, -4);
    const last = addDays(max, 12);
    return {
      first,
      last,
      span: dayDiff(first, last) + 1,
      working: workingDaysInclusive(first, last, cal),
    };
  }, [schedule, data.project.startDate, cal]);

  const toggleWeekendDay = (day: number) => {
    const active = cal.weekendDays.includes(day);
    const next = active ? cal.weekendDays.filter((d) => d !== day) : [...cal.weekendDays, day];
    if (next.length >= 7) {
      setError('Minimal harus ada satu hari kerja dalam seminggu.');
      return;
    }
    setError(null);
    setWeekendDays(next);
  };

  const submitHoliday = (event: FormEvent) => {
    event.preventDefault();
    if (!isValidISO(date)) {
      setError('Pilih tanggal libur yang valid.');
      return;
    }
    if (cal.holidays.some((h) => h.date === date)) {
      setError('Tanggal tersebut sudah terdaftar sebagai hari libur.');
      return;
    }
    addHoliday(date, name.trim() || 'Hari Libur');
    setDate('');
    setName('');
    setError(null);
  };

  const sortedHolidays = [...cal.holidays].sort((a, b) => a.date.localeCompare(b.date));
  const weekendLabel =
    WEEKDAYS.filter((d) => cal.weekendDays.includes(d))
      .map((d) => weekdayName(d))
      .join(', ') || '(tidak ada akhir pekan)';

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Kalender Proyek</h2>
          <p className="muted">
            Akhir pekan: {weekendLabel} · hari libur khusus: {cal.holidays.length} tanggal
          </p>
        </div>
      </header>

      <div className="calendar-grid">
        <div className="card">
          <h3>Pengaturan Akhir Pekan</h3>
          <p className="muted small">Hari yang dicentang tidak dihitung dalam durasi maupun jadwal.</p>
          <div className="weekend-row">
            {WEEKDAYS.map((day) => {
              const active = cal.weekendDays.includes(day);
              return (
                <label key={day} className={`day-toggle${active ? ' is-active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleWeekendDay(day)}
                  />
                  <span>{weekdayName(day)}</span>
                </label>
              );
            })}
          </div>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="card">
          <h3>Ringkasan Kalender</h3>
          <dl className="stat-list">
            <div>
              <dt>Rentang rencana</dt>
              <dd>
                {formatDateID(stats.first)} — {formatDateID(stats.last)}
              </dd>
            </div>
            <div>
              <dt>Total hari kalender</dt>
              <dd>{stats.span} hari</dd>
            </div>
            <div>
              <dt>Total hari kerja</dt>
              <dd>{stats.working} hari</dd>
            </div>
            <div>
              <dt>Durasi proyek (jadwal)</dt>
              <dd>{Math.max(0, schedule.projectFinishIndex - schedule.projectStartIndex + 1)} hari kerja</dd>
            </div>
          </dl>
        </div>

        <div className="card card-wide">
          <h3>Hari Libur Khusus</h3>
          <form className="holiday-form" onSubmit={submitHoliday}>
            <Field label="Tanggal" htmlFor="holiday-date">
              <input
                id="holiday-date"
                className="input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Nama libur" htmlFor="holiday-name">
              <input
                id="holiday-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mis. Libur Lebaran"
              />
            </Field>
            <button type="submit" className="btn btn-primary">
              Tambah Libur
            </button>
          </form>

          <ul className="holiday-list">
            {sortedHolidays.length === 0 ? (
              <li className="muted small">Belum ada hari libur khusus.</li>
            ) : null}
            {sortedHolidays.map((holiday) => (
              <li key={holiday.id} className="holiday-item">
                <div>
                  <strong>{holiday.name}</strong>
                  <span className="muted small">{formatFullDateID(holiday.date)}</span>
                </div>
                <button
                  type="button"
                  className="icon-btn danger"
                  aria-label={`Hapus libur ${holiday.name}`}
                  onClick={() => removeHoliday(holiday.id)}
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
