import { describe, expect, it } from 'vitest';
import type { CalendarConfig, Task } from '../types';
import {
  computePertStats,
  computeSchedule,
  pertExpected,
  pertStdDev,
  topologicalOrder,
} from './scheduling';

const cal: CalendarConfig = { weekendDays: [0, 6], holidays: [] };

function makeTask(partial: Partial<Task> & { id: string }): Task {
  return {
    name: partial.name ?? partial.id,
    description: '',
    startDate: '2026-01-05', // Senin
    duration: 3,
    priority: 'Medium',
    color: '#4f6df5',
    parentId: null,
    dependencies: [],
    assigneeIds: [],
    progress: 0,
    collapsed: false,
    pert: { optimistic: 3, mostLikely: 3, pessimistic: 3 },
    ...partial,
  };
}

/**
 * 2026-01-05 Senin, 07 Rabu, 09 Jumat, 12 Senin, 13 Selasa, 20 Selasa.
 */
describe('computeSchedule', () => {
  it('menjadwalkan Finish-to-Start dengan lag hari kerja', () => {
    const a = makeTask({ id: 'a', startDate: '2026-01-05', duration: 3 });
    const b = makeTask({
      id: 'b',
      startDate: '2026-01-05',
      duration: 2,
      dependencies: [{ taskId: 'a', type: 'FS', lag: 2 }],
    });

    const result = computeSchedule([a, b], cal);

    expect(result.items.a.start).toBe('2026-01-05');
    expect(result.items.a.finish).toBe('2026-01-07'); // Rabu
    // Rabu + 1 hari + lag 2 = Kamis, Jumat, Senin -> mulai Senin 12 Jan
    expect(result.items.b.start).toBe('2026-01-12');
    expect(result.items.b.finish).toBe('2026-01-13');
    expect(result.hasCycle).toBe(false);
  });

  it('menjadwalkan Start-to-Start dengan lag', () => {
    const c = makeTask({ id: 'c', startDate: '2026-01-05', duration: 5 });
    const d = makeTask({
      id: 'd',
      startDate: '2026-01-05',
      duration: 3,
      dependencies: [{ taskId: 'c', type: 'SS', lag: 2 }],
    });

    const result = computeSchedule([c, d], cal);

    expect(result.items.d.start).toBe('2026-01-07'); // Senin + 2 hari kerja
    expect(result.items.d.finish).toBe('2026-01-09'); // Jumat
  });

  it('menghormati tanggal mulai manual sebagai batas bawah', () => {
    const a = makeTask({ id: 'a', startDate: '2026-01-05', duration: 3 });
    const b = makeTask({
      id: 'b',
      startDate: '2026-01-20', // jauh setelah predecessor selesai
      duration: 2,
      dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }],
    });

    const result = computeSchedule([a, b], cal);
    expect(result.items.b.start).toBe('2026-01-20');
  });

  it('menentukan jalur kritis dan slack', () => {
    const a = makeTask({ id: 'a', startDate: '2026-01-05', duration: 4 });
    const b = makeTask({
      id: 'b',
      startDate: '2026-01-05',
      duration: 3,
      dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }],
    });
    const x = makeTask({ id: 'x', startDate: '2026-01-05', duration: 1 }); // paralel pendek

    const result = computeSchedule([a, b, x], cal);

    expect(result.projectFinish).toBe('2026-01-13');
    expect(result.items.a.critical).toBe(true);
    expect(result.items.b.critical).toBe(true);
    expect(result.items.a.slack).toBe(0);
    expect(result.items.x.critical).toBe(false);
    expect(result.items.x.slack).toBeGreaterThan(0);
    expect(result.criticalIds).toContain('a');
    expect(result.criticalIds).toContain('b');
    expect(result.criticalIds).not.toContain('x');
    expect(new Set(result.order)).toEqual(new Set(['a', 'b', 'x']));
    expect(result.order.indexOf('a')).toBeLessThan(result.order.indexOf('b')); // topologis
  });

  it('slack tidak negatif pada graf yang valid', () => {
    const a = makeTask({ id: 'a', duration: 6 });
    const b = makeTask({ id: 'b', duration: 2, dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }] });
    const c = makeTask({ id: 'c', duration: 4, dependencies: [{ taskId: 'a', type: 'SS', lag: 1 }] });
    const result = computeSchedule([a, b, c], cal);
    for (const item of Object.values(result.items)) {
      expect(item.slack).toBeGreaterThanOrEqual(0);
    }
  });

  it('tanggal non-kerja diambil hari kerja berikutnya', () => {
    const t = makeTask({ id: 'w', startDate: '2026-01-03', duration: 1 }); // Sabtu
    const result = computeSchedule([t], cal);
    expect(result.items.w.start).toBe('2026-01-05');
    expect(result.items.w.finish).toBe('2026-01-05');
  });

  it('mendeteksi siklus tanpa menggantung', () => {
    const a = makeTask({ id: 'a', dependencies: [{ taskId: 'b', type: 'FS', lag: 0 }] });
    const b = makeTask({ id: 'b', dependencies: [{ taskId: 'a', type: 'FS', lag: 0 }] });

    const { order, hasCycle } = topologicalOrder([a, b]);
    expect(hasCycle).toBe(true);
    expect(new Set(order)).toEqual(new Set(['a', 'b']));

    const result = computeSchedule([a, b], cal);
    expect(result.hasCycle).toBe(true);
    expect(result.items.a).toBeDefined();
    expect(result.items.b).toBeDefined();
  });

  it('mengabaikan predecessor yang tidak ada', () => {
    const t = makeTask({ id: 't', dependencies: [{ taskId: 'hilang', type: 'FS', lag: 0 }] });
    const result = computeSchedule([t], cal);
    expect(result.items.t.start).toBe('2026-01-05');
  });
});

describe('PERT', () => {
  it('menghitung waktu ekspektasi dan simpangan baku', () => {
    const pert = { optimistic: 4, mostLikely: 6, pessimistic: 14 };
    expect(pertExpected(pert)).toBeCloseTo(7, 6); // (4 + 4*6 + 14) / 6
    expect(pertStdDev(pert)).toBeCloseTo((14 - 4) / 6, 6);
  });

  it('estimasi proyek memakai jalur ekspektasi', () => {
    const t = makeTask({
      id: 'p',
      duration: 3,
      pert: { optimistic: 2, mostLikely: 3, pessimistic: 4 },
    });
    const stats = computePertStats([t], cal);
    expect(stats.expected).toBe(3);
    expect(stats.pathIds).toContain('p');
    expect(stats.variance).toBeCloseTo(((4 - 2) / 6) ** 2, 6);
    expect(stats.stdDev).toBeCloseTo(Math.sqrt(((4 - 2) / 6) ** 2), 6);
  });
});
