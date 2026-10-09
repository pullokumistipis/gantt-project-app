import { useMemo } from 'react';
import { useProject } from '../state/ProjectContext';
import { computePertStats, pertExpected, pertStdDev } from '../utils/scheduling';
import { formatDateID, indexToDate } from '../utils/dates';
import { formatNumber } from '../utils/format';
import { PertDiagram } from './PertDiagram';

export function AnalysisView({ onOpenGantt }: { onOpenGantt: () => void }) {
  const { data, schedule, taskById } = useProject();
  const pert = useMemo(() => computePertStats(data.tasks, data.calendar), [data.tasks, data.calendar]);

  const duration = Math.max(0, schedule.projectFinishIndex - schedule.projectStartIndex + 1);
  const criticalTasks = schedule.criticalIds
    .map((id) => taskById.get(id))
    .filter((task): task is NonNullable<typeof task> => Boolean(task));
  const totalTasks = data.tasks.length;

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Analisis Proyek</h2>
          <p className="muted">
            Critical Path Method (CPM) &amp; PERT di atas kalender hari kerja proyek
          </p>
        </div>
        <div className="panel-actions">
          <button type="button" className="btn btn-primary" onClick={onOpenGantt}>
            Sorot di Gantt Chart
          </button>
        </div>
      </header>

      {schedule.hasCycle ? (
        <div className="form-error" role="alert">
          Terdapat siklus (loop) pada dependensi tugas. Perbaiki dependensi agar analisis bisa
          dihitung penuh.
        </div>
      ) : null}

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-label">Durasi proyek</span>
          <span className="stat-value">{duration} hari kerja</span>
          <span className="stat-sub">
            {formatDateID(schedule.projectStart)} → {formatDateID(schedule.projectFinish)}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Tugas pada jalur kritis</span>
          <span className="stat-value">
            {criticalTasks.length} / {totalTasks}
          </span>
          <span className="stat-sub">slack = 0 hari</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Estimasi PERT</span>
          <span className="stat-value">{formatNumber(pert.expected, 1)} hari</span>
          <span className="stat-sub">
            σ {formatNumber(pert.stdDev, 1)} · keyakinan ±2σ ≈ {formatNumber(pert.expected - 2 * pert.stdDev, 1)}–
            {formatNumber(pert.expected + 2 * pert.stdDev, 1)} hari
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Anggota tim</span>
          <span className="stat-value">{data.members.length} orang</span>
          <span className="stat-sub">teralokasi ke tugas</span>
        </div>
      </div>

      <div className="card card-wide">
        <div className="card-head">
          <h3>Jalur Kritis (Critical Path)</h3>
          <span className="muted small">Urutan tugas dengan slack = 0 — keterlambatan langsung menunda proyek</span>
        </div>
        {criticalTasks.length === 0 ? (
          <p className="muted">Belum ada tugas pada jalur kritis.</p>
        ) : (
          <>
            <ol className="critical-chain">
              {criticalTasks.map((task) => {
                const item = schedule.items[task.id];
                return (
                  <li key={task.id}>
                    <span className="chain-chip" title={task.name}>
                      {task.name}
                      <small>
                        {item ? `${item.duration} hr` : ''}
                      </small>
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="table-scroll">
              <table className="task-table analysis-table">
                <thead>
                  <tr>
                    <th className="col-name">Tugas</th>
                    <th>Mulai</th>
                    <th>Selesai</th>
                    <th className="num">Durasi</th>
                    <th>Latest start</th>
                    <th>Latest finish</th>
                    <th className="num">Slack</th>
                  </tr>
                </thead>
                <tbody>
                  {criticalTasks.map((task) => {
                    const item = schedule.items[task.id];
                    if (!item) return null;
                    return (
                      <tr key={task.id}>
                        <td className="col-name">
                          <span className="dot" style={{ backgroundColor: task.color }} /> {task.name}
                        </td>
                        <td>{formatDateID(item.start)}</td>
                        <td>{formatDateID(item.finish)}</td>
                        <td className="num">{item.duration} hr</td>
                        <td>{formatDateID(indexToDate(item.lateStart, data.calendar))}</td>
                        <td>{formatDateID(indexToDate(item.lateFinish, data.calendar))}</td>
                        <td className="num">{item.slack} hr</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="card card-wide">
        <div className="card-head">
          <h3>Estimasi PERT per Tugas</h3>
          <span className="muted small">E = (O + 4M + P) / 6 · σ = (P − O) / 6</span>
        </div>
        <div className="table-scroll">
          <table className="task-table analysis-table">
            <thead>
              <tr>
                <th className="col-name">Tugas</th>
                <th className="num">Optimis (O)</th>
                <th className="num">Paling mungkin (M)</th>
                <th className="num">Pesimis (P)</th>
                <th className="num">E</th>
                <th className="num">σ</th>
                <th className="num">Varian</th>
              </tr>
            </thead>
            <tbody>
              {data.tasks.map((task) => {
                const expected = pertExpected(task.pert);
                const sigma = pertStdDev(task.pert);
                const critical = Boolean(schedule.items[task.id]?.critical);
                return (
                  <tr key={task.id} className={critical ? 'is-critical' : ''}>
                    <td className="col-name">
                      <span className="dot" style={{ backgroundColor: task.color }} /> {task.name}
                      {critical ? <span className="crit-mark">KP</span> : null}
                    </td>
                    <td className="num">{task.pert.optimistic}</td>
                    <td className="num">{task.pert.mostLikely}</td>
                    <td className="num">{task.pert.pessimistic}</td>
                    <td className="num strong">{formatNumber(expected, 2)}</td>
                    <td className="num">{formatNumber(sigma, 2)}</td>
                    <td className="num">{formatNumber(sigma * sigma, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-wide">
        <div className="card-head">
          <h3>Diagram PERT</h3>
          <span className="muted small">
            Jaringan tugas · merah = jalur kritis · label panah = jenis dependensi + lag
          </span>
        </div>
        <PertDiagram />
      </div>
    </section>
  );
}
