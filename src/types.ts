export type Priority = 'Low' | 'Medium' | 'High';

export type DependencyType = 'FS' | 'SS';

export interface Dependency {
  /** id of the predecessor task */
  taskId: string;
  /** FS = Finish-to-Start, SS = Start-to-Start */
  type: DependencyType;
  /** lag/delay in working days */
  lag: number;
}

export interface PertEstimate {
  optimistic: number;
  mostLikely: number;
  pessimistic: number;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  /** ISO date (yyyy-mm-dd). Acts as the earliest-start constraint of the task. */
  startDate: string;
  /** duration in working days (weekends + holidays are skipped) */
  duration: number;
  priority: Priority;
  /** bar color indicator */
  color: string;
  /** parent task id for sub-tasks (null = top level) */
  parentId: string | null;
  /** incoming predecessors */
  dependencies: Dependency[];
  /** ids of allocated members */
  assigneeIds: string[];
  /** completion 0..100 */
  progress: number;
  /** whether the sub-task list of this task is collapsed in the tree */
  collapsed: boolean;
  pert: PertEstimate;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  /** monthly salary */
  salary: number;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export interface CalendarConfig {
  /** day numbers 0 (Sun) .. 6 (Sat) treated as weekend */
  weekendDays: number[];
  holidays: Holiday[];
}

export interface ProjectMeta {
  name: string;
  startDate: string;
}

export interface ProjectData {
  project: ProjectMeta;
  tasks: Task[];
  members: Member[];
  calendar: CalendarConfig;
}

export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High'];

export const PRIORITY_COLORS: Record<Priority, string> = {
  Low: '#3b82f6',
  Medium: '#f59e0b',
  High: '#ef4444',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  Low: 'Rendah',
  Medium: 'Sedang',
  High: 'Tinggi',
};

export const BAR_COLORS = [
  '#4f6df5',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
];
