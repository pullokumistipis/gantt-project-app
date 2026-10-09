import { useMemo, useState, type FormEvent } from 'react';
import type { Dependency, DependencyType, Priority, Task } from '../types';
import { BAR_COLORS, PRIORITIES, PRIORITY_LABELS } from '../types';
import { useProject, type TaskInput } from '../state/ProjectContext';
import { isValidISO, todayISO } from '../utils/dates';
import { topologicalOrder } from '../utils/scheduling';
import { canBeParent, canAddDependency } from '../utils/taskUtils';
import { Field, Modal, PriorityBadge } from './common';

function defaultPert(duration: number) {
  const d = Math.max(1, Math.round(duration) || 1);
  return { optimistic: Math.max(1, Math.round(d * 0.7)), mostLikely: d, pessimistic: Math.max(d + 1, Math.round(d * 1.5)) };
}

function sortPert(p: { optimistic: number; mostLikely: number; pessimistic: number }) {
  const values = [p.optimistic, p.mostLikely, p.pessimistic].map((v) => Math.max(1, Math.round(v) || 1));
  values.sort((a, b) => a - b);
  return { optimistic: values[0], mostLikely: values[1], pessimistic: values[2] };
}

export function TaskForm({
  task,
  defaultParentId,
  onClose,
}: {
  task?: Task | null;
  defaultParentId?: string | null;
  onClose: () => void;
}) {
  const { data, createTask, updateTask } = useProject();
  const editing = Boolean(task);

  const [name, setName] = useState(task?.name ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [startDate, setStartDate] = useState(task?.startDate ?? data.project.startDate ?? todayISO());
  const [duration, setDuration] = useState(task?.duration ?? 3);
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'Medium');
  const [color, setColor] = useState(task?.color ?? BAR_COLORS[0]);
  const [parentId, setParentId] = useState<string | null>(task ? task.parentId : (defaultParentId ?? null));
  const [dependencies, setDependencies] = useState<Dependency[]>(task?.dependencies ?? []);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assigneeIds ?? []);
  const [progress, setProgress] = useState(task?.progress ?? 0);
  const [pert, setPert] = useState(task?.pert ?? defaultPert(task?.duration ?? 3));
  const [pertTouched, setPertTouched] = useState(editing);
  const [error, setError] = useState<string | null>(null);

  const selfId = task?.id ?? '';
  const parentOptions = useMemo(
    () => data.tasks.filter((t) => canBeParent(data.tasks, selfId, t.id)),
    [data.tasks, selfId],
  );
  const dependencyOptions = useMemo(
    () => data.tasks.filter((t) => t.id !== selfId && (!editing || canAddDependency(data.tasks, selfId, t.id))),
    [data.tasks, selfId, editing],
  );

  const usedPredecessorIds = new Set(dependencies.map((d) => d.taskId));

  const addDependency = () => {
    const next = dependencyOptions.find((t) => !usedPredecessorIds.has(t.id));
    if (!next) return;
    setDependencies([...dependencies, { taskId: next.id, type: 'FS', lag: 0 }]);
  };

  const patchDependency = (index: number, patch: Partial<Dependency>) => {
    setDependencies(dependencies.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const taskLabel = (id: string) => data.tasks.find((t) => t.id === id)?.name ?? '(tugas terhapus)';

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Nama tugas wajib diisi.');
      return;
    }
    if (!isValidISO(startDate)) {
      setError('Tanggal mulai tidak valid.');
      return;
    }
    if (!Number.isFinite(Number(duration)) || Math.floor(Number(duration)) < 1) {
      setError('Durasi minimal 1 hari kerja.');
      return;
    }
    if (!canBeParent(data.tasks, selfId, parentId)) {
      setError('Induk tugas tidak boleh berada di bawah tugas ini sendiri.');
      return;
    }
    if (task) {
      const probe = data.tasks.map((t) => (t.id === task.id ? { ...t, dependencies } : t));
      if (topologicalOrder(probe).hasCycle) {
        setError('Dependensi membentuk siklus (loop). Hapus salah satu dependensi dulu.');
        return;
      }
    }

    const input: TaskInput = {
      name: trimmed,
      description: description.trim(),
      startDate,
      duration: Math.max(1, Math.floor(Number(duration))),
      priority,
      color,
      parentId,
      dependencies: dependencies.map((d) => ({ ...d, lag: Math.max(0, Math.floor(d.lag) || 0) })),
      assigneeIds,
      progress: Math.min(100, Math.max(0, Math.round(progress))),
      pert: sortPert(pert),
    };

    if (task) updateTask(task.id, input);
    else createTask(input);
    onClose();
  };

  return (
    <Modal title={editing ? 'Edit Tugas' : 'Tugas Baru'} onClose={onClose}>
      <form className="form-grid" onSubmit={onSubmit}>
        {error ? <div className="form-error" role="alert">{error}</div> : null}

        <Field label="Nama tugas *" htmlFor="task-name" wide>
          <input
            id="task-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mis. Analisis Kebutuhan"
            autoFocus
          />
        </Field>

        <Field label="Deskripsi" htmlFor="task-desc" wide>
          <textarea
            id="task-desc"
            className="input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Deskripsi singkat tugas"
          />
        </Field>

        <Field label="Induk tugas (sub-tugas)" htmlFor="task-parent" hint="Kosong = tugas tingkat atas">
          <select
            id="task-parent"
            className="input"
            value={parentId ?? ''}
            onChange={(e) => setParentId(e.target.value || null)}
          >
            <option value="">— Tugas utama —</option>
            {parentOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Prioritas" htmlFor="task-priority">
          <select
            id="task-priority"
            className="input"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tanggal mulai *" htmlFor="task-start">
          <input
            id="task-start"
            className="input"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>

        <Field label="Durasi (hari kerja) *" htmlFor="task-duration" hint="Akhir pekan & hari libur tidak dihitung">
          <input
            id="task-duration"
            className="input"
            type="number"
            min={1}
            value={duration}
            onChange={(e) => {
              const value = Number(e.target.value);
              setDuration(value);
              if (!pertTouched && Number.isFinite(value) && value >= 1) setPert(defaultPert(value));
            }}
          />
        </Field>

        <Field label="Progres (%)" htmlFor="task-progress">
          <div className="range-row">
            <input
              id="task-progress"
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
            />
            <span className="range-value">{progress}%</span>
          </div>
        </Field>

        <Field label="Warna indikator bar" htmlFor="task-color">
          <div className="color-row">
            <input
              id="task-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Pilih warna bar"
            />
            {BAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`swatch${c === color ? ' is-active' : ''}`}
                style={{ backgroundColor: c }}
                aria-label={`Warna ${c}`}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </Field>

        <div className="field field-wide">
          <span className="field-label">Predecessor &amp; hubungan</span>
          <div className="dep-list">
            {dependencies.length === 0 ? (
              <p className="muted small">Belum ada dependensi. Tugas berjalan sesuai tanggal mulainya.</p>
            ) : null}
            {dependencies.map((dep, index) => (
              <div className="dep-row" key={`${dep.taskId}-${index}`}>
                <select
                  className="input"
                  value={dep.taskId}
                  aria-label="Tugas pendahulu"
                  onChange={(e) => patchDependency(index, { taskId: e.target.value })}
                >
                  <option value={dep.taskId}>{taskLabel(dep.taskId)}</option>
                  {dependencyOptions
                    .filter((t) => t.id !== dep.taskId && !usedPredecessorIds.has(t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
                <select
                  className="input input-sm"
                  value={dep.type}
                  aria-label="Jenis hubungan"
                  onChange={(e) => patchDependency(index, { type: e.target.value as DependencyType })}
                >
                  <option value="FS">FS (Finish→Start)</option>
                  <option value="SS">SS (Start→Start)</option>
                </select>
                <label className="lag-input">
                  Jeda
                  <input
                    className="input input-sm"
                    type="number"
                    min={0}
                    value={dep.lag}
                    aria-label="Jeda hari (lag)"
                    onChange={(e) => patchDependency(index, { lag: Number(e.target.value) })}
                  />
                  hr
                </label>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Hapus dependensi"
                  onClick={() => setDependencies(dependencies.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={addDependency}
              disabled={dependencies.length >= dependencyOptions.length}
            >
              + Tambah dependensi
            </button>
          </div>
        </div>

        <div className="field field-wide">
          <span className="field-label">Alokasi anggota tim</span>
          {data.members.length === 0 ? (
            <p className="muted small">Belum ada anggota. Tambahkan anggota pada tab “Sumber Daya”.</p>
          ) : (
            <div className="chip-list">
              {data.members.map((member) => {
                const active = assigneeIds.includes(member.id);
                return (
                  <label key={member.id} className={`chip${active ? ' is-active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() =>
                        setAssigneeIds(
                          active ? assigneeIds.filter((id) => id !== member.id) : [...assigneeIds, member.id],
                        )
                      }
                    />
                    {member.name}
                    <span className="chip-sub">{member.role}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="field field-wide">
          <span className="field-label">Estimasi PERT (hari)</span>
          <div className="pert-row">
            <label className="pert-cell">
              Optimis
              <input
                className="input input-sm"
                type="number"
                min={1}
                value={pert.optimistic}
                onChange={(e) => {
                  setPertTouched(true);
                  setPert({ ...pert, optimistic: Number(e.target.value) });
                }}
              />
            </label>
            <label className="pert-cell">
              Paling mungkin
              <input
                className="input input-sm"
                type="number"
                min={1}
                value={pert.mostLikely}
                onChange={(e) => {
                  setPertTouched(true);
                  setPert({ ...pert, mostLikely: Number(e.target.value) });
                }}
              />
            </label>
            <label className="pert-cell">
              Pesimis
              <input
                className="input input-sm"
                type="number"
                min={1}
                value={pert.pessimistic}
                onChange={(e) => {
                  setPertTouched(true);
                  setPert({ ...pert, pessimistic: Number(e.target.value) });
                }}
              />
            </label>
          </div>
        </div>

        {editing && task ? (
          <p className="muted small field-wide">
            Prioritas saat ini: <PriorityBadge priority={task.priority} />
          </p>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary">
            {editing ? 'Simpan Perubahan' : 'Tambah Tugas'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
