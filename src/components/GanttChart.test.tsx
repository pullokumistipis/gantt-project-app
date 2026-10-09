import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ProjectProvider } from '../state/ProjectContext';
import { createSeedData } from '../utils/seed';
import { GanttChart } from './GanttChart';

afterEach(cleanup);

function renderGantt() {
  const seed = createSeedData();
  const utils = render(
    <ProjectProvider initialData={seed}>
      <GanttChart />
    </ProjectProvider>,
  );
  return { ...utils, seed };
}

describe('GanttChart', () => {
  it('merender satu bar untuk setiap tugas terlihat', () => {
    const { container, seed } = renderGantt();
    const bars = container.querySelectorAll('.gantt-bar');
    expect(bars.length).toBe(seed.tasks.length);
  });

  it('merender panah dependensi untuk hubungan FS dan SS', () => {
    const { container, seed } = renderGantt();
    const paths = container.querySelectorAll('.gantt-dep-path');
    const totalDeps = seed.tasks.reduce((sum, task) => sum + task.dependencies.length, 0);
    expect(paths.length).toBe(totalDeps);
    expect(totalDeps).toBeGreaterThan(0);
  });

  it('menyediakan kontrol zoom, jalur kritis, dan hari ini', () => {
    const { container } = renderGantt();

    fireEvent.click(container.querySelector('.seg-btn:nth-child(2)')!); // Pekan
    expect(container.querySelectorAll('.gantt-bar').length).toBeGreaterThan(0);

    fireEvent.click(container.querySelector('.seg-btn:nth-child(3)')!); // Bulan
    expect(container.querySelectorAll('.gantt-bar').length).toBeGreaterThan(0);

    const criticalToggle = container.querySelector('.check-inline input') as HTMLInputElement;
    expect(criticalToggle.checked).toBe(true);
    expect(container.querySelectorAll('.gantt-bar.is-critical').length).toBeGreaterThan(0);

    fireEvent.click(criticalToggle);
    expect(criticalToggle.checked).toBe(false);
    expect(container.querySelectorAll('.gantt-bar.is-critical').length).toBe(0);

    fireEvent.click(container.querySelector('.btn-ghost.btn-sm')!); // Hari ini
    expect(container.querySelectorAll('.gantt-bar').length).toBeGreaterThan(0);
  });

  it('memilih tugas saat baris diklik', () => {
    const { container } = renderGantt();
    const rowLeft = container.querySelector('.gantt-row-left') as HTMLElement;
    expect(container.querySelector('.gantt-row.is-selected')).toBeNull();

    fireEvent.click(rowLeft);
    expect(container.querySelector('.gantt-row.is-selected')).not.toBeNull();
  });

  it('menampilkan header bulan dan kolom hari', () => {
    const { container } = renderGantt();
    expect(container.querySelectorAll('.gantt-month').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.gantt-day').length).toBeGreaterThan(20);
    expect(container.querySelectorAll('.gantt-col.is-weekend').length).toBeGreaterThan(0);
  });
});
