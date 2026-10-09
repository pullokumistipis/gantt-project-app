import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  CalendarConfig,
  Dependency,
  Holiday,
  Member,
  PertEstimate,
  Priority,
  ProjectData,
  Task,
} from '../types';
import { computeSchedule, type ScheduleResult } from '../utils/scheduling';
import { flattenTasks, newId, removeTask, type FlatTask } from '../utils/taskUtils';
import { createSeedData } from '../utils/seed';
import { loadProjectData, saveProjectData } from '../utils/storage';

export interface TaskInput {
  name: string;
  description: string;
  startDate: string;
  duration: number;
  priority: Priority;
  color: string;
  parentId: string | null;
  dependencies: Dependency[];
  assigneeIds: string[];
  progress: number;
  pert: PertEstimate;
}

interface ProjectContextValue {
  data: ProjectData;
  schedule: ScheduleResult;
  rows: FlatTask[];
  taskById: Map<string, Task>;
  selectedTaskId: string | null;
  selectTask: (id: string | null) => void;
  createTask: (input: TaskInput) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleCollapse: (id: string) => void;
  createMember: (input: Omit<Member, 'id'>) => string;
  updateMember: (id: string, patch: Partial<Member>) => void;
  deleteMember: (id: string) => void;
  addHoliday: (date: string, name: string) => void;
  removeHoliday: (id: string) => void;
  setWeekendDays: (days: number[]) => void;
  updateProject: (patch: Partial<ProjectData['project']>) => void;
  resetData: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  children,
  initialData,
}: {
  children: ReactNode;
  initialData?: ProjectData;
}) {
  const [data, setData] = useState<ProjectData>(() => initialData ?? loadProjectData());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    saveProjectData(data);
  }, [data]);

  const schedule = useMemo(() => computeSchedule(data.tasks, data.calendar), [data.tasks, data.calendar]);
  const rows = useMemo(() => flattenTasks(data.tasks), [data.tasks]);
  const taskById = useMemo(() => new Map(data.tasks.map((t) => [t.id, t])), [data.tasks]);

  const value = useMemo<ProjectContextValue>(() => {
    const createTask = (input: TaskInput): string => {
      const id = newId('t');
      setData((current) => ({
        ...current,
        tasks: [
          ...current.tasks.map((task) =>
            input.parentId && task.id === input.parentId ? { ...task, collapsed: false } : task,
          ),
          {
            ...input,
            id,
            collapsed: false,
            duration: Math.max(1, Math.floor(input.duration) || 1),
            progress: Math.min(100, Math.max(0, input.progress)),
            dependencies: input.dependencies.map((d) => ({
              ...d,
              lag: Math.max(0, Math.floor(d.lag) || 0),
            })),
          },
        ],
      }));
      setSelectedTaskId(id);
      return id;
    };

    const updateTask = (id: string, patch: Partial<Task>) => {
      setData((current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === id
            ? {
                ...task,
                ...patch,
                duration: patch.duration !== undefined ? Math.max(1, Math.floor(patch.duration) || 1) : task.duration,
                progress:
                  patch.progress !== undefined
                    ? Math.min(100, Math.max(0, patch.progress))
                    : task.progress,
                dependencies: (patch.dependencies ?? task.dependencies).map((d) => ({
                  ...d,
                  lag: Math.max(0, Math.floor(d.lag) || 0),
                })),
              }
            : task,
        ),
      }));
    };

    const deleteTask = (id: string) => {
      setData((current) => ({ ...current, tasks: removeTask(current.tasks, id) }));
      setSelectedTaskId((current) => (current === id ? null : current));
    };

    const toggleCollapse = (id: string) => {
      setData((current) => ({
        ...current,
        tasks: current.tasks.map((task) => (task.id === id ? { ...task, collapsed: !task.collapsed } : task)),
      }));
    };

    const createMember = (input: Omit<Member, 'id'>): string => {
      const id = newId('m');
      setData((current) => ({ ...current, members: [...current.members, { ...input, id }] }));
      return id;
    };

    const updateMember = (id: string, patch: Partial<Member>) => {
      setData((current) => ({
        ...current,
        members: current.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      }));
    };

    const deleteMember = (id: string) => {
      setData((current) => ({
        ...current,
        members: current.members.filter((m) => m.id !== id),
        tasks: current.tasks.map((task) => ({
          ...task,
          assigneeIds: task.assigneeIds.filter((assigneeId) => assigneeId !== id),
        })),
      }));
    };

    const withCalendar = (fn: (cal: CalendarConfig) => CalendarConfig) => {
      setData((current) => ({ ...current, calendar: fn(current.calendar) }));
    };

    const addHoliday = (date: string, name: string) => {
      withCalendar((cal) =>
        cal.holidays.some((h) => h.date === date)
          ? cal
          : { ...cal, holidays: [...cal.holidays, { id: newId('h'), date, name } as Holiday] },
      );
    };

    const removeHoliday = (id: string) => {
      withCalendar((cal) => ({ ...cal, holidays: cal.holidays.filter((h) => h.id !== id) }));
    };

    const setWeekendDays = (days: number[]) => {
      const unique = [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
      if (unique.length >= 7) return; // a calendar needs at least one working day
      withCalendar((cal) => ({ ...cal, weekendDays: unique }));
    };

    const updateProject = (patch: Partial<ProjectData['project']>) => {
      setData((current) => ({ ...current, project: { ...current.project, ...patch } }));
    };

    const resetData = () => {
      setData(createSeedData());
      setSelectedTaskId(null);
    };

    return {
      data,
      schedule,
      rows,
      taskById,
      selectedTaskId,
      selectTask: setSelectedTaskId,
      createTask,
      updateTask,
      deleteTask,
      toggleCollapse,
      createMember,
      updateMember,
      deleteMember,
      addHoliday,
      removeHoliday,
      setWeekendDays,
      updateProject,
      resetData,
    };
  }, [data, schedule, rows, taskById, selectedTaskId]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject harus dipakai di dalam <ProjectProvider>');
  return ctx;
}
