import { useMemo, useState, type FormEvent } from 'react';
import type { Member } from '../types';
import { useProject } from '../state/ProjectContext';
import { formatIDR } from '../utils/format';
import { Field, Modal } from './common';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ResourcesView() {
  const { data, schedule, createMember, updateMember, deleteMember } = useProject();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [salary, setSalary] = useState(10_000_000);
  const [error, setError] = useState<string | null>(null);

  const workload = useMemo(() => {
    const map = new Map<string, { count: number; names: string[]; days: number }>();
    for (const member of data.members) map.set(member.id, { count: 0, names: [], days: 0 });
    for (const task of data.tasks) {
      for (const id of task.assigneeIds) {
        const entry = map.get(id);
        if (!entry) continue;
        entry.count += 1;
        entry.names.push(task.name);
        entry.days += schedule.items[task.id]?.duration ?? task.duration;
      }
    }
    return map;
  }, [data.members, data.tasks, schedule]);

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setEmail('');
    setRole('');
    setSalary(10_000_000);
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (member: Member) => {
    setEditingId(member.id);
    setName(member.name);
    setEmail(member.email);
    setRole(member.role);
    setSalary(member.salary);
    setError(null);
    setFormOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Nama anggota wajib diisi.');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Format email tidak valid.');
      return;
    }
    if (!role.trim()) {
      setError('Peran wajib diisi.');
      return;
    }
    if (!Number.isFinite(salary) || salary < 0) {
      setError('Gaji tidak boleh negatif.');
      return;
    }
    const payload = { name: name.trim(), email: email.trim(), role: role.trim(), salary: Math.round(salary) };
    if (editingId) updateMember(editingId, payload);
    else createMember(payload);
    setFormOpen(false);
  };

  const handleDelete = (member: Member) => {
    const ok = window.confirm(`Hapus anggota "${member.name}"? Alokasinya akan dilepas dari semua tugas.`);
    if (ok) deleteMember(member.id);
  };

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Sumber Daya Manusia</h2>
          <p className="muted">{data.members.length} anggota terdaftar · alokasikan anggota ke tugas lewat form tugas</p>
        </div>
        <div className="panel-actions">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Tambah Anggota
          </button>
        </div>
      </header>

      <div className="member-grid">
        {data.members.length === 0 ? (
          <p className="empty-state">Belum ada anggota. Klik “Tambah Anggota” untuk mendaftarkan tim.</p>
        ) : null}
        {data.members.map((member) => {
          const load = workload.get(member.id);
          return (
            <article className="member-card" key={member.id}>
              <header className="member-head">
                <span className="avatar avatar-lg">
                  {member.name
                    .split(' ')
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <div>
                  <h3>{member.name}</h3>
                  <p className="muted">{member.role}</p>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Edit ${member.name}`}
                    onClick={() => openEdit(member)}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label={`Hapus ${member.name}`}
                    onClick={() => handleDelete(member)}
                  >
                    🗑
                  </button>
                </div>
              </header>
              <dl className="member-meta">
                <div>
                  <dt>Email</dt>
                  <dd>{member.email}</dd>
                </div>
                <div>
                  <dt>Gaji / bulan</dt>
                  <dd>{formatIDR(member.salary)}</dd>
                </div>
                <div>
                  <dt>Alokasi</dt>
                  <dd>
                    {load?.count ?? 0} tugas · {load?.days ?? 0} hari kerja
                  </dd>
                </div>
              </dl>
              {load && load.names.length > 0 ? (
                <div className="chip-list">
                  {load.names.map((taskName) => (
                    <span className="chip-static" key={taskName}>
                      {taskName}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted small">Belum dialokasikan ke tugas mana pun.</p>
              )}
            </article>
          );
        })}
      </div>

      {formOpen ? (
        <Modal
          title={editingId ? 'Edit Anggota' : 'Tambah Anggota'}
          onClose={() => setFormOpen(false)}
        >
          <form className="form-grid" onSubmit={submit}>
            {error ? (
              <div className="form-error" role="alert">
                {error}
              </div>
            ) : null}
            <Field label="Nama lengkap *" htmlFor="member-name" wide>
              <input
                id="member-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mis. Sari Rahmawati"
                autoFocus
              />
            </Field>
            <Field label="Email *" htmlFor="member-email">
              <input
                id="member-email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@perusahaan.com"
              />
            </Field>
            <Field label="Peran *" htmlFor="member-role">
              <input
                id="member-role"
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Mis. Backend Developer"
              />
            </Field>
            <Field label="Gaji (Rp / bulan) *" htmlFor="member-salary">
              <input
                id="member-salary"
                className="input"
                type="number"
                min={0}
                step={100_000}
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value))}
              />
            </Field>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setFormOpen(false)}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary">
                Simpan
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
