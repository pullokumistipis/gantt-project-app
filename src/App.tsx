import { useEffect, useState } from 'react';
import { ProjectProvider, useProject } from './state/ProjectContext';
import { TaskList } from './components/TaskList';
import { GanttChart } from './components/GanttChart';
import { ResourcesView } from './components/ResourcesView';
import { CalendarView } from './components/CalendarView';
import { AnalysisView } from './components/AnalysisView';
import { formatDateID } from './utils/dates';

type TabId = 'tasks' | 'gantt' | 'resources' | 'calendar' | 'analysis';

const TABS: { id: TabId; label: string }[] = [
  { id: 'tasks', label: 'Tugas' },
  { id: 'gantt', label: 'Gantt Chart' },
  { id: 'resources', label: 'Sumber Daya' },
  { id: 'calendar', label: 'Kalender' },
  { id: 'analysis', label: 'Analisis' },
];

function tabFromHash(): TabId {
  const hash = window.location.hash.replace('#', '');
  return (TABS.some((t) => t.id === hash) ? hash : 'tasks') as TabId;
}

function Shell() {
  const { data, updateProject, resetData, schedule } = useProject();
  const [tab, setTab] = useState<TabId>(tabFromHash);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const goTab = (id: TabId) => {
    setTab(id);
    window.location.hash = id;
  };

  const handleReset = () => {
    const ok = window.confirm('Kembalikan seluruh data ke contoh awal? Perubahan Anda akan hilang.');
    if (ok) resetData();
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">▦</span>
          <div>
            <strong>GanttPro</strong>
            <span className="brand-sub">Manajemen Proyek</span>
          </div>
        </div>
        <input
          className="project-name"
          value={data.project.name}
          aria-label="Nama proyek"
          onChange={(e) => updateProject({ name: e.target.value })}
        />
        <div className="topbar-meta">
          <span>
            Mulai proyek: <strong>{formatDateID(data.project.startDate)}</strong>
          </span>
          <span>
            Selesai: <strong>{formatDateID(schedule.projectFinish)}</strong>
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleReset}>
            Reset data contoh
          </button>
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Navigasi utama">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`tab${tab === item.id ? ' is-active' : ''}`}
            onClick={() => goTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main className="container">
        {tab === 'tasks' ? <TaskList /> : null}
        {tab === 'gantt' ? <GanttChart /> : null}
        {tab === 'resources' ? <ResourcesView /> : null}
        {tab === 'calendar' ? <CalendarView /> : null}
        {tab === 'analysis' ? <AnalysisView onOpenGantt={() => goTab('gantt')} /> : null}
      </main>

      <footer className="footer">
        Data tersimpan otomatis di localStorage · durasi dihitung dalam hari kerja (akhir pekan &amp;
        hari libur tidak dihitung)
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ProjectProvider>
      <Shell />
    </ProjectProvider>
  );
}
