import { describe, expect, it } from 'vitest';
import { createSeedData } from './seed';
import { computeSchedule, topologicalOrder } from './scheduling';
import { orderedTasks, removeTask } from './taskUtils';
import { isValidISO } from './dates';
import { isValidProjectData, normalizeProjectData } from './storage';

const data = createSeedData();

describe('seed data', () => {
  it('berisi tugas, anggota, akhir pekan dan hari libur', () => {
    expect(data.tasks.length).toBeGreaterThanOrEqual(12);
    expect(data.members.length).toBeGreaterThanOrEqual(4);
    expect(data.calendar.weekendDays).toEqual([0, 6]);
    expect(data.calendar.holidays.length).toBeGreaterThanOrEqual(1);
    expect(data.project.name.length).toBeGreaterThan(0);
    expect(isValidISO(data.project.startDate)).toBe(true);
  });

  it('setiap tugas valid', () => {
    for (const task of data.tasks) {
      expect(task.name.trim().length).toBeGreaterThan(0);
      expect(task.duration).toBeGreaterThanOrEqual(1);
      expect(isValidISO(task.startDate)).toBe(true);
      expect(['Low', 'Medium', 'High']).toContain(task.priority);
      expect(task.pert.optimistic).toBeLessThanOrEqual(task.pert.mostLikely);
      expect(task.pert.mostLikely).toBeLessThanOrEqual(task.pert.pessimistic);
      if (task.parentId) {
        expect(data.tasks.some((t) => t.id === task.parentId)).toBe(true);
      }
      expect(orderedTasks(data.tasks).length).toBe(data.tasks.length); // hierarki bebas siklus
    }
  });

  it('referensi dependensi dan anggota selalu valid', () => {
    const ids = new Set(data.tasks.map((t) => t.id));
    const memberIds = new Set(data.members.map((m) => m.id));
    for (const task of data.tasks) {
      for (const dep of task.dependencies) {
        expect(ids.has(dep.taskId)).toBe(true);
        expect(dep.taskId).not.toBe(task.id);
        expect(['FS', 'SS']).toContain(dep.type);
        expect(dep.lag).toBeGreaterThanOrEqual(0);
      }
      for (const id of task.assigneeIds) {
        expect(memberIds.has(id)).toBe(true);
      }
    }
  });

  it('tidak mengandung siklus dependensi', () => {
    const { order, hasCycle } = topologicalOrder(data.tasks);
    expect(hasCycle).toBe(false);
    expect(order.length).toBe(data.tasks.length);
  });

  it('tanggal tersimpan konsisten dengan hasil penjadwalan', () => {
    const schedule = computeSchedule(data.tasks, data.calendar);
    expect(schedule.hasCycle).toBe(false);
    expect(schedule.criticalIds.length).toBeGreaterThan(0);
    for (const task of data.tasks) {
      const item = schedule.items[task.id];
      expect(item).toBeDefined();
      expect(item?.start).toBe(task.startDate);
      expect(item!.finish >= item!.start).toBe(true);
      expect(item!.duration).toBe(task.duration);
    }
  });

  it('memiliki jalur kritis dengan tugas paralel yang ber-slack', () => {
    const schedule = computeSchedule(data.tasks, data.calendar);
    expect(schedule.criticalIds).toContain('t1_1');
    expect(schedule.criticalIds).toContain('t3_3');
    expect(schedule.criticalIds).not.toContain('t3_2');
    expect(schedule.items.t3_2.slack).toBeGreaterThan(0);
    expect(schedule.projectFinishIndex).toBeGreaterThan(schedule.projectStartIndex);
  });

  it('sub-tugas menempel pada induknya', () => {
    const children = data.tasks.filter((t) => t.parentId === 't1');
    expect(children.length).toBeGreaterThanOrEqual(3);
    expect(data.tasks.filter((t) => t.parentId === null).length).toBeGreaterThanOrEqual(4);
  });
});

describe('removeTask', () => {
  it('mempromosikan sub-tugas dan membersihkan dependensi', () => {
    const result = removeTask(data.tasks, 't1');
    expect(result.find((t) => t.id === 't1')).toBeUndefined();
    // anak-anak t1 naik ke root
    expect(result.find((t) => t.id === 't1_1')?.parentId).toBeNull();
    // tidak ada dependensi yang menunjuk ke t1
    for (const task of result) {
      expect(task.dependencies.some((d) => d.taskId === 't1')).toBe(false);
    }
  });
});

describe('storage validation', () => {
  it('data seed dikenali sebagai valid', () => {
    expect(isValidProjectData(data)).toBe(true);
  });

  it('menolak data rusak', () => {
    expect(isValidProjectData(null)).toBe(false);
    expect(isValidProjectData({})).toBe(false);
    expect(isValidProjectData({ ...data, tasks: 'bukan-array' })).toBe(false);
    const broken = { ...data, tasks: [{ ...data.tasks[0], startDate: 'tanggal-ngawur' }] };
    expect(isValidProjectData(broken)).toBe(false);
    const danglingDep = {
      ...data,
      tasks: [{ ...data.tasks[0], dependencies: [{ taskId: 'tidak-ada', type: 'FS', lag: 0 }] }],
    };
    expect(isValidProjectData(danglingDep)).toBe(false);
  });

  it('normalisasi mengisi field opsional', () => {
    const raw = JSON.parse(JSON.stringify(data)) as typeof data;
    delete (raw.tasks[0] as Partial<(typeof data.tasks)[0]>).progress;
    const normalized = normalizeProjectData(raw);
    expect(normalized.tasks[0].progress).toBe(0);
    expect(normalized.tasks[0].collapsed).toBe(false);
    expect(normalized.tasks[0].pert).toBeDefined();
    expect(isValidProjectData(normalized)).toBe(true);
  });
});
