import type { CalendarConfig, Member, ProjectData, Task } from '../types';
import { isValidISO } from './dates';
import { createSeedData } from './seed';

export const STORAGE_KEY = 'ganttpro.project.v1';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

export function isValidProjectData(value: unknown): value is ProjectData {
  if (!isObject(value)) return false;
  const { project, tasks, members, calendar } = value;
  if (!isObject(project)) return false;
  if (typeof project.name !== 'string') return false;
  if (!isValidISO(project.startDate)) return false;
  if (!Array.isArray(tasks) || !Array.isArray(members) || !isObject(calendar)) return false;
  if (!Array.isArray(calendar.weekendDays) || !calendar.weekendDays.every((d) => typeof d === 'number')) return false;
  if (!Array.isArray(calendar.holidays)) return false;

  for (const holiday of calendar.holidays) {
    if (!isObject(holiday) || typeof holiday.id !== 'string' || typeof holiday.name !== 'string' || !isValidISO(holiday.date)) {
      return false;
    }
  }

  for (const member of members as Member[]) {
    if (!isObject(member)) return false;
    if (typeof member.id !== 'string' || typeof member.name !== 'string') return false;
    if (typeof member.email !== 'string' || typeof member.role !== 'string') return false;
    if (typeof member.salary !== 'number' || Number.isNaN(member.salary)) return false;
  }

  const memberIds = new Set((members as Member[]).map((m) => m.id));
  const taskIds = new Set<string>();
  for (const task of tasks as Task[]) {
    if (!isObject(task)) return false;
    if (typeof task.id !== 'string' || typeof task.name !== 'string') return false;
    if (typeof task.duration !== 'number' || task.duration < 1) return false;
    if (!isValidISO(task.startDate)) return false;
    if (typeof task.color !== 'string') return false;
    if (task.parentId !== null && typeof task.parentId !== 'string') return false;
    if (task.priority !== 'Low' && task.priority !== 'Medium' && task.priority !== 'High') return false;
    if (!Array.isArray(task.dependencies) || !Array.isArray(task.assigneeIds)) return false;
    if (!isStringArray(task.assigneeIds)) return false;
    if (!isObject(task.pert)) return false;
    taskIds.add(task.id);
  }
  for (const task of tasks as Task[]) {
    if (task.parentId !== null && !taskIds.has(task.parentId)) return false;
    for (const dep of task.dependencies) {
      if (!isObject(dep) || typeof dep.taskId !== 'string') return false;
      if (dep.type !== 'FS' && dep.type !== 'SS') return false;
      if (typeof dep.lag !== 'number') return false;
      if (!taskIds.has(dep.taskId)) return false;
    }
    for (const id of task.assigneeIds) {
      if (!memberIds.has(id)) return false;
    }
  }
  return true;
}

/** Fills optional fields so older saves keep working. */
export function normalizeProjectData(data: ProjectData): ProjectData {
  return {
    project: data.project,
    calendar: data.calendar,
    members: data.members.map((m) => ({ ...m, salary: Number(m.salary) || 0 })),
    tasks: data.tasks.map((task) => ({
      ...task,
      description: task.description ?? '',
      progress: typeof task.progress === 'number' ? Math.min(100, Math.max(0, task.progress)) : 0,
      collapsed: Boolean(task.collapsed),
      dependencies: (task.dependencies ?? []).map((d) => ({ ...d, lag: Math.max(0, Math.floor(d.lag) || 0) })),
      assigneeIds: task.assigneeIds ?? [],
      pert: task.pert ?? {
        optimistic: task.duration,
        mostLikely: task.duration,
        pessimistic: Math.max(task.duration, Math.round(task.duration * 1.5)),
      },
    })),
  };
}

export function loadProjectData(): ProjectData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedData();
    const parsed: unknown = JSON.parse(raw);
    if (isValidProjectData(parsed)) return normalizeProjectData(parsed);
    return createSeedData();
  } catch {
    return createSeedData();
  }
}

export function saveProjectData(data: ProjectData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable — the app keeps working in memory
  }
}

export function clearProjectData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export type { CalendarConfig };
