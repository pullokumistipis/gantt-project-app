import type { CalendarConfig, Member, ProjectData, Task } from '../types';
import { addDays, addWorkingDays, todayISO, workingDaysInclusive } from './dates';
import { computeSchedule } from './scheduling';

/** next Monday on or after today (falls back to today) */
function nextMonday(iso: string): string {
  const day = new Date(`${iso}T00:00:00.000Z`).getUTCDay();
  const shift = (8 - day) % 7;
  return addDays(iso, shift);
}

function pert(optimistic: number, mostLikely: number, pessimistic: number) {
  return { optimistic, mostLikely, pessimistic };
}

export function createSeedData(): ProjectData {
  const projectStart = nextMonday(todayISO());

  const calendar: CalendarConfig = {
    weekendDays: [0, 6],
    holidays: [
      { id: 'h1', date: addWorkingDays(projectStart, 12, { weekendDays: [0, 6], holidays: [] }), name: 'Hari Libur Nasional' },
      { id: 'h2', date: addWorkingDays(projectStart, 25, { weekendDays: [0, 6], holidays: [] }), name: 'Cuti Bersama' },
    ],
  };

  const members: Member[] = [
    { id: 'm1', name: 'Ayu Larasati', email: 'ayu.larasati@example.com', role: 'Project Manager', salary: 15_000_000 },
    { id: 'm2', name: 'Budi Santoso', email: 'budi.santoso@example.com', role: 'Fullstack Developer', salary: 13_000_000 },
    { id: 'm3', name: 'Citra Dewi', email: 'citra.dewi@example.com', role: 'UI/UX Designer', salary: 11_000_000 },
    { id: 'm4', name: 'Dimas Pratama', email: 'dimas.pratama@example.com', role: 'QA Engineer', salary: 10_000_000 },
  ];

  const base = {
    startDate: projectStart,
    progress: 0,
    collapsed: false,
    description: '',
  };

  const tasks: Task[] = [
    {
      ...base,
      id: 't1',
      name: 'Fase 1 — Perencanaan',
      description: 'Analisis kebutuhan hingga persetujuan stakeholder.',
      duration: 10,
      priority: 'High',
      color: '#8b5cf6',
      parentId: null,
      dependencies: [],
      assigneeIds: ['m1'],
      progress: 80,
      pert: pert(8, 10, 15),
    },
    {
      ...base,
      id: 't1_1',
      name: 'Analisis Kebutuhan',
      description: 'Wawancara pengguna dan pemetaan kebutuhan bisnis.',
      duration: 4,
      priority: 'High',
      color: '#4f6df5',
      parentId: 't1',
      dependencies: [],
      assigneeIds: ['m1'],
      progress: 100,
      pert: pert(3, 4, 7),
    },
    {
      ...base,
      id: 't1_2',
      name: 'Dokumen Spesifikasi',
      description: 'Menyusun dokumen SRS yang ditinjau tim.',
      duration: 3,
      priority: 'Medium',
      color: '#4f6df5',
      parentId: 't1',
      dependencies: [{ taskId: 't1_1', type: 'FS', lag: 0 }],
      assigneeIds: ['m1'],
      progress: 100,
      pert: pert(2, 3, 6),
    },
    {
      ...base,
      id: 't1_3',
      name: 'Persetujuan Stakeholder',
      description: 'Review dan tanda tangan persetujuan dokumen.',
      duration: 2,
      priority: 'High',
      color: '#ef4444',
      parentId: 't1',
      dependencies: [{ taskId: 't1_2', type: 'FS', lag: 1 }],
      assigneeIds: ['m1'],
      progress: 60,
      pert: pert(1, 2, 5),
    },
    {
      ...base,
      id: 't2',
      name: 'Fase 2 — Desain',
      description: 'Wireframe, desain UI, dan review desain.',
      duration: 5,
      priority: 'Medium',
      color: '#0ea5e9',
      parentId: null,
      dependencies: [],
      assigneeIds: ['m3'],
      progress: 40,
      pert: pert(4, 5, 9),
    },
    {
      ...base,
      id: 't2_1',
      name: 'Wireframe & Desain UI',
      description: 'Wireframe high-fidelity dan design system.',
      duration: 5,
      priority: 'High',
      color: '#0ea5e9',
      parentId: 't2',
      dependencies: [{ taskId: 't1_3', type: 'FS', lag: 0 }],
      assigneeIds: ['m3'],
      progress: 30,
      pert: pert(4, 5, 10),
    },
    {
      ...base,
      id: 't2_2',
      name: 'Review Desain',
      description: 'Evaluasi desain bersama product owner (SS + lag 3 hari).',
      duration: 2,
      priority: 'Medium',
      color: '#0ea5e9',
      parentId: 't2',
      dependencies: [{ taskId: 't2_1', type: 'SS', lag: 3 }],
      assigneeIds: ['m1', 'm3'],
      progress: 10,
      pert: pert(1, 2, 4),
    },
    {
      ...base,
      id: 't3',
      name: 'Fase 3 — Pengembangan',
      description: 'Implementasi frontend, backend, dan integrasi.',
      duration: 17,
      priority: 'High',
      color: '#10b981',
      parentId: null,
      dependencies: [],
      assigneeIds: ['m2'],
      pert: pert(14, 17, 26),
    },
    {
      ...base,
      id: 't3_1',
      name: 'Setup Environment & CI',
      description: 'Monorepo, pipeline CI/CD, dan environment staging.',
      duration: 3,
      priority: 'Medium',
      color: '#10b981',
      parentId: 't3',
      dependencies: [{ taskId: 't2_2', type: 'FS', lag: 0 }],
      assigneeIds: ['m2'],
      pert: pert(2, 3, 5),
    },
    {
      ...base,
      id: 't3_2',
      name: 'Pengembangan Frontend',
      description: 'Implementasi halaman dan komponen React.',
      duration: 8,
      priority: 'High',
      color: '#4f6df5',
      parentId: 't3',
      dependencies: [{ taskId: 't3_1', type: 'FS', lag: 0 }],
      assigneeIds: ['m2'],
      pert: pert(6, 8, 14),
    },
    {
      ...base,
      id: 't3_3',
      name: 'Pengembangan Backend & API',
      description: 'REST API, autentikasi, dan migrasi database.',
      duration: 10,
      priority: 'High',
      color: '#10b981',
      parentId: 't3',
      dependencies: [{ taskId: 't3_1', type: 'FS', lag: 0 }],
      assigneeIds: ['m2'],
      pert: pert(8, 10, 18),
    },
    {
      ...base,
      id: 't3_4',
      name: 'Integrasi Front-Backend',
      description: 'Connecting the dots: konsumsi API di frontend.',
      duration: 4,
      priority: 'Medium',
      color: '#8b5cf6',
      parentId: 't3',
      dependencies: [
        { taskId: 't3_2', type: 'FS', lag: 0 },
        { taskId: 't3_3', type: 'FS', lag: 0 },
      ],
      assigneeIds: ['m2'],
      pert: pert(3, 4, 8),
    },
    {
      ...base,
      id: 't4',
      name: 'Fase 4 — Testing & Rilis',
      description: 'Pengujian, perbaikan bug, dan deployment.',
      duration: 11,
      priority: 'High',
      color: '#f59e0b',
      parentId: null,
      dependencies: [],
      assigneeIds: ['m4'],
      pert: pert(9, 11, 18),
    },
    {
      ...base,
      id: 't4_1',
      name: 'Pengujian QA',
      description: 'Regression test, UAT, dan smoke test.',
      duration: 5,
      priority: 'High',
      color: '#f59e0b',
      parentId: 't4',
      dependencies: [{ taskId: 't3_4', type: 'FS', lag: 0 }],
      assigneeIds: ['m4'],
      pert: pert(4, 5, 9),
    },
    {
      ...base,
      id: 't4_2',
      name: 'Perbaikan Bug',
      description: 'Triage dan perbaikan bug prioritas tinggi.',
      duration: 4,
      priority: 'Medium',
      color: '#ef4444',
      parentId: 't4',
      dependencies: [{ taskId: 't4_1', type: 'FS', lag: 0 }],
      assigneeIds: ['m2', 'm4'],
      pert: pert(2, 4, 10),
    },
    {
      ...base,
      id: 't4_3',
      name: 'Deployment & Rilis',
      description: 'Deploy ke production dan pengumuman rilis.',
      duration: 2,
      priority: 'High',
      color: '#ef4444',
      parentId: 't4',
      dependencies: [{ taskId: 't4_2', type: 'FS', lag: 0 }],
      assigneeIds: ['m1', 'm2'],
      pert: pert(1, 2, 4),
    },
  ];

  return stabilizeSeed({ project: { name: 'Peluncuran Aplikasi Mobile', startDate: projectStart }, tasks, members, calendar });
}

/**
 * Runs the scheduler once so stored dates match the dependency network, then
 * stretches every parent bar over its sub-tasks so the sample data looks like a
 * finished plan (parents keep fully editable dates afterwards).
 */
export function stabilizeSeed(data: ProjectData): ProjectData {
  const first = computeSchedule(data.tasks, data.calendar);
  const withDates = data.tasks.map((task) => ({
    ...task,
    startDate: first.items[task.id]?.start ?? task.startDate,
  }));

  const byId = new Map(withDates.map((t) => [t.id, t]));
  const startOf = (id: string) => byId.get(id)?.startDate ?? data.project.startDate;
  const finishOf = (id: string) => first.items[id]?.finish ?? startOf(id);

  const children = (parentId: string) => withDates.filter((t) => t.parentId === parentId);
  const allDescendants = (parentId: string): Task[] => {
    const result: Task[] = [];
    const walk = (id: string) => {
      for (const child of children(id)) {
        result.push(child);
        walk(child.id);
      }
    };
    walk(parentId);
    return result;
  };

  const aligned = withDates.map((task) => {
    const kids = allDescendants(task.id);
    if (kids.length === 0) return task;
    let start = startOf(task.id);
    let finish = finishOf(task.id);
    for (const kid of kids) {
      if (startOf(kid.id) < start) start = startOf(kid.id);
      if (finishOf(kid.id) > finish) finish = finishOf(kid.id);
    }
    const span = workingDaysInclusive(start, finish, data.calendar);
    return { ...task, startDate: start, duration: Math.max(1, span) };
  });

  return { ...data, tasks: aligned };
}
