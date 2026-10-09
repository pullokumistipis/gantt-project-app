import { useMemo, useState } from 'react';
import type { Task } from '../types';
import { useProject } from '../state/ProjectContext';
import { formatDateID } from '../utils/dates';
import { orderedTasks } from '../utils/taskUtils';
import { PriorityBadge } from './common';
import { TaskForm } from './TaskForm';

export function TaskList() {
  const { data, rows, schedule, taskById, deleteTask, toggleCollapse, selectTask, selectedTaskId } =
    useProject();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return orderedTasks(data.tasks)
      .filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
      .map((task) => ({ task, depth: 0, hasChildren: false }));
  }, [rows, data.tasks, query]);

  const openCreate = (parentId: string | null = null) => {
    setCreateParentId(parentId);
    setCreating(true);
  };

  const handleDelete = (task: Task) => {
    const ok = window.confirm(
      `Hapus tugas "${task.name}"? Sub-tugas akan dipindahkan ke induknya dan dependensi terkait ikut dihapus.`,
    );
    if (ok) deleteTask(task.id);
  };

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Daftar Tugas</h2>
          <p className="muted">
            {data.tasks.length} tugas · {schedule.criticalIds.filter((id) => taskById.has(id)).length} pada jalur
            kritis · durasi dihitung dalam hari kerja
          </p>
        </div>
        <div className="panel-actions">
          <input
            className="input search"
            type="search"
            placeholder="Cari tugas…"
            aria-label="Cari tugas"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="btn btn-primary" onClick={() => openCreate(null)}>
            + Tugas Baru
          </button>
        </div>
      </header>

      <div className="table-scroll">
        <table className="task-table">
          <thead>
            <tr>
              <th className="col-name">Tugas</th>
              <th>Prioritas</th>
              <th>Mulai</th>
              <th>Selesai</th>
              <th className="num">Durasi</th>
              <th>Predecessor</th>
              <th>Anggota</th>
              <th className="num">Progres</th>
              <th className="col-actions">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty">
                  Tidak ada tugas yang cocok.
                </td>
              </tr>
            ) : null}
            {visible.map(({ task, depth, hasChildren }) => {
              const item = schedule.items[task.id];
              const members = task.assigneeIds
                .map((id) => data.members.find((m) => m.id === id))
                .filter(Boolean);
              const selected = selectedTaskId === task.id;
              return (
                <tr
                  key={task.id}
                  className={`${selected ? 'is-selected' : ''}${item?.critical ? ' is-critical' : ''}`}
                  onClick={() => selectTask(task.id)}
                >
                  <td className="col-name">
                    <div className="name-cell" style={{ paddingLeft: depth * 18 }}>
                      <button
                        type="button"
                        className={`caret${hasChildren ? '' : ' is-hidden'}`}
                        aria-label={task.collapsed ? 'Buka sub-tugas' : 'Tutup sub-tugas'}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hasChildren) toggleCollapse(task.id);
                        }}
                      >
                        {task.collapsed ? '▸' : '▾'}
                      </button>
                      <span className="dot" style={{ backgroundColor: task.color }} />
                      <span className="task-name" title={task.name}>
                        {task.name}
                      </span>
                      {item?.critical ? <span className="crit-mark" title="Jalur kritis">KP</span> : null}
                    </div>
                  </td>
                  <td>
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td>{formatDateID(item?.start ?? task.startDate)}</td>
                  <td>{formatDateID(item?.finish ?? task.startDate)}</td>
                  <td className="num">{item?.duration ?? task.duration} hr</td>
                  <td>
                    {task.dependencies.length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      <div className="dep-chips">
                        {task.dependencies.map((dep) => (
                          <span className="chip-static" key={`${dep.taskId}-${dep.type}`}>
                            {dep.type}
                            {dep.lag > 0 ? `+${dep.lag}` : ''} ·{' '}
                            {taskById.get(dep.taskId)?.name ?? '?'}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    {members.length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      <div className="avatar-row">
                        {members.map(
                          (m) =>
                            m ? (
                              <span className="avatar" key={m.id} title={`${m.name} — ${m.role}`}>
                                {m.name
                                  .split(' ')
                                  .map((p) => p[0])
                                  .slice(0, 2)
                                  .join('')}
                              </span>
                            ) : null,
                        )}
                      </div>
                    )}
                  </td>
                  <td className="num">
                    <div className="progress" title={`${task.progress}%`}>
                      <div className="progress-fill" style={{ width: `${task.progress}%` }} />
                    </div>
                  </td>
                  <td className="col-actions">
                    <div className="row-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Tambah sub-tugas di ${task.name}`}
                        title="Tambah sub-tugas"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreate(task.id);
                        }}
                      >
                        ＋
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Edit ${task.name}`}
                        title="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(task);
                        }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        aria-label={`Hapus ${task.name}`}
                        title="Hapus"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(task);
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {creating ? (
        <TaskForm
          defaultParentId={createParentId}
          onClose={() => {
            setCreating(false);
            setCreateParentId(null);
          }}
        />
      ) : null}
      {editing ? <TaskForm task={editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}
