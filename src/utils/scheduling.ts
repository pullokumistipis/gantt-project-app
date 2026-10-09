import type { CalendarConfig, Dependency, Task } from '../types';
import { dateToIndex, indexToDate } from './dates';

export interface ScheduleItem {
  id: string;
  /** early start / finish (working-day indexes) */
  earlyStart: number;
  earlyFinish: number;
  /** late start / finish (working-day indexes) */
  lateStart: number;
  lateFinish: number;
  slack: number;
  critical: boolean;
  /** scheduled dates */
  start: string;
  finish: string;
  duration: number;
}

export interface ScheduleResult {
  items: Record<string, ScheduleItem>;
  /** topological order (predecessors first) */
  order: string[];
  projectStartIndex: number;
  projectFinishIndex: number;
  projectStart: string;
  projectFinish: string;
  /** ids of critical tasks, in topological order */
  criticalIds: string[];
  hasCycle: boolean;
}

function durationOf(task: Task): number {
  const d = Math.floor(Number(task.duration));
  return Number.isFinite(d) && d >= 1 ? d : 1;
}

/**
 * Kahn topological sort over dependency edges. Tasks referenced by missing or
 * cyclic dependencies are appended at the end so every task still gets a
 * schedule entry (the graph is reported as cyclic instead of hanging).
 */
export function topologicalOrder(tasks: Task[]): { order: string[]; hasCycle: boolean } {
  const ids = new Set(tasks.map((t) => t.id));
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const task of tasks) {
    indegree.set(task.id, 0);
    outgoing.set(task.id, []);
  }
  for (const task of tasks) {
    const seen = new Set<string>();
    for (const dep of task.dependencies) {
      if (!ids.has(dep.taskId) || dep.taskId === task.id || seen.has(dep.taskId)) continue;
      seen.add(dep.taskId);
      indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1);
      outgoing.get(dep.taskId)!.push(task.id);
    }
  }

  const queue = tasks.filter((t) => (indegree.get(t.id) ?? 0) === 0).map((t) => t.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of outgoing.get(id) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  const hasCycle = order.length !== tasks.length;
  if (hasCycle) {
    const placed = new Set(order);
    for (const task of tasks) if (!placed.has(task.id)) order.push(task.id);
  }
  return { order, hasCycle };
}

interface SuccessorLink {
  successorId: string;
  dependency: Dependency;
}

/**
 * Critical Path Method over a working-day calendar.
 *
 * Forward pass: ES = max(manual start date, every predecessor constraint)
 *   FS: ES_succ >= EF_pred + 1 + lag
 *   SS: ES_succ >= ES_pred + lag
 * Backward pass derives the latest start of every task from its successors,
 * slack = LS - ES and slack == 0 marks the critical path.
 */
export function computeSchedule(tasks: Task[], cal: CalendarConfig): ScheduleResult {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const { order, hasCycle } = topologicalOrder(tasks);

  const items: Record<string, ScheduleItem> = {};

  // ---- forward pass -------------------------------------------------------
  for (const id of order) {
    const task = byId.get(id);
    if (!task) continue;
    let es = dateToIndex(task.startDate, cal);
    const seen = new Set<string>();
    for (const dep of task.dependencies) {
      if (seen.has(dep.taskId)) continue;
      seen.add(dep.taskId);
      const pred = items[dep.taskId];
      if (!pred) continue; // missing/cyclic predecessor -> ignore
      const constraint =
        dep.type === 'FS'
          ? pred.earlyFinish + 1 + Math.max(0, Math.floor(dep.lag) || 0)
          : pred.earlyStart + Math.max(0, Math.floor(dep.lag) || 0);
      if (constraint > es) es = constraint;
    }
    const duration = durationOf(task);
    const ef = es + duration - 1;
    items[id] = {
      id,
      earlyStart: es,
      earlyFinish: ef,
      lateStart: es,
      lateFinish: ef,
      slack: 0,
      critical: false,
      start: indexToDate(es, cal),
      finish: indexToDate(ef, cal),
      duration,
    };
  }

  // ---- backward pass ------------------------------------------------------
  const successors = new Map<string, SuccessorLink[]>();
  for (const task of tasks) {
    const seen = new Set<string>();
    for (const dep of task.dependencies) {
      if (seen.has(dep.taskId) || !items[dep.taskId]) continue;
      seen.add(dep.taskId);
      const list = successors.get(dep.taskId) ?? [];
      list.push({ successorId: task.id, dependency: dep });
      successors.set(dep.taskId, list);
    }
  }

  let projectFinishIndex = 0;
  let projectStartIndex = Number.POSITIVE_INFINITY;
  for (const item of Object.values(items)) {
    if (item.earlyFinish > projectFinishIndex) projectFinishIndex = item.earlyFinish;
    if (item.earlyStart < projectStartIndex) projectStartIndex = item.earlyStart;
  }
  if (!Number.isFinite(projectStartIndex)) projectStartIndex = 0;

  for (let i = order.length - 1; i >= 0; i -= 1) {
    const id = order[i];
    const item = items[id];
    const task = byId.get(id);
    if (!item || !task) continue;
    const links = successors.get(id) ?? [];
    let ls: number | null = null;
    for (const link of links) {
      const succ = items[link.successorId];
      if (!succ) continue;
      const lag = Math.max(0, Math.floor(link.dependency.lag) || 0);
      const candidate =
        link.dependency.type === 'FS'
          ? succ.lateStart - lag - item.duration
          : succ.lateStart - lag;
      if (ls === null || candidate < ls) ls = candidate;
    }
    if (ls === null) ls = projectFinishIndex - item.duration + 1;
    item.lateStart = ls;
    item.lateFinish = ls + item.duration - 1;
    item.slack = ls - item.earlyStart;
    item.critical = item.slack <= 0;
  }

  const criticalIds = order.filter((id) => items[id]?.critical);

  return {
    items,
    order,
    projectStartIndex,
    projectFinishIndex,
    projectStart: indexToDate(projectStartIndex, cal),
    projectFinish: indexToDate(projectFinishIndex, cal),
    criticalIds,
    hasCycle,
  };
}

// ---------------------------------------------------------------------------
// PERT
// ---------------------------------------------------------------------------

export function pertExpected(pert: Task['pert']): number {
  return (pert.optimistic + 4 * pert.mostLikely + pert.pessimistic) / 6;
}

export function pertStdDev(pert: Task['pert']): number {
  return (pert.pessimistic - pert.optimistic) / 6;
}

export interface PertStats {
  expected: number;
  variance: number;
  stdDev: number;
  pathIds: string[];
}

/**
 * Project level PERT statistics: the network is re-evaluated using the
 * expected time of every task, then the resulting critical path is measured.
 */
export function computePertStats(tasks: Task[], cal: CalendarConfig): PertStats {
  const withExpected = tasks.map((task) => ({
    ...task,
    duration: Math.max(1, Math.ceil(pertExpected(task.pert))),
  }));
  const schedule = computeSchedule(withExpected, cal);
  let variance = 0;
  for (const id of schedule.criticalIds) {
    const task = tasks.find((t) => t.id === id);
    if (!task) continue;
    const sd = pertStdDev(task.pert);
    variance += sd * sd;
  }
  const expected = schedule.projectFinishIndex - schedule.projectStartIndex + 1;
  return {
    expected,
    variance,
    stdDev: Math.sqrt(variance),
    pathIds: schedule.criticalIds,
  };
}
