import type { Task } from '../types';

export interface FlatTask {
  task: Task;
  depth: number;
  hasChildren: boolean;
}

export function childrenOf(tasks: Task[], parentId: string | null): Task[] {
  return tasks.filter((t) => t.parentId === parentId);
}

/** Tree order (roots first, children nested) regardless of collapse state. */
export function orderedTasks(tasks: Task[]): Task[] {
  const result: Task[] = [];
  const visit = (parentId: string | null) => {
    for (const task of tasks.filter((t) => t.parentId === parentId)) {
      result.push(task);
      visit(task.id);
    }
  };
  visit(null);
  return result;
}

/** Flattened visible rows: respects the `collapsed` flag of parents. */
export function flattenTasks(tasks: Task[]): FlatTask[] {
  const result: FlatTask[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const task of tasks.filter((t) => t.parentId === parentId)) {
      const kids = childrenOf(tasks, task.id);
      result.push({ task, depth, hasChildren: kids.length > 0 });
      if (!task.collapsed) visit(task.id, depth + 1);
    }
  };
  visit(null, 0);
  // orphan safety: tasks whose parent no longer exists
  const placed = new Set(result.map((r) => r.task.id));
  for (const task of orderedTasks(tasks)) {
    if (!placed.has(task.id)) result.push({ task, depth: 0, hasChildren: false });
  }
  return result;
}

export function descendantIds(tasks: Task[], id: string): string[] {
  const result: string[] = [];
  const visit = (parentId: string) => {
    for (const child of tasks.filter((t) => t.parentId === parentId)) {
      result.push(child.id);
      visit(child.id);
    }
  };
  visit(id);
  return result;
}

/** true when `taskId` can already reach `predecessorId` through dependencies */
function canReach(tasks: Task[], fromId: string, targetId: string): boolean {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const stack = [fromId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === targetId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    const task = byId.get(current);
    if (!task) continue;
    for (const dep of task.dependencies) stack.push(dep.taskId);
  }
  return false;
}

/** Guards against self references and dependency cycles. */
export function canAddDependency(tasks: Task[], taskId: string, predecessorId: string): boolean {
  if (!taskId || !predecessorId) return false;
  if (taskId === predecessorId) return false;
  return !canReach(tasks, predecessorId, taskId);
}

/** Guards the parent selector against cycles in the hierarchy. */
export function canBeParent(tasks: Task[], taskId: string, parentId: string | null): boolean {
  if (parentId === null) return true;
  if (parentId === taskId) return false;
  return !descendantIds(tasks, taskId).includes(parentId);
}

/**
 * Removes a task: its sub-tasks are promoted to the deleted task's parent and
 * every dependency pointing at it is dropped.
 */
export function removeTask(tasks: Task[], id: string): Task[] {
  const target = tasks.find((t) => t.id === id);
  const promotedParent = target?.parentId ?? null;
  return tasks
    .filter((t) => t.id !== id)
    .map((t) => ({
      ...t,
      parentId: t.parentId === id ? promotedParent : t.parentId,
      dependencies: t.dependencies.filter((d) => d.taskId !== id),
    }));
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}
