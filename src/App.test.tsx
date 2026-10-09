import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';

afterEach(cleanup);

describe('App', () => {
  it('menampilkan tab dan beralih ke seluruh tampilan tanpa error', () => {
    const { container } = render(<App />);

    // tab Tugas (default)
    expect(screen.getByText('Daftar Tugas')).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(5);

    // tab Gantt Chart
    fireEvent.click(screen.getByRole('tab', { name: 'Gantt Chart' }));
    expect(container.querySelector('.gantt-scroll')).toBeTruthy();
    expect(container.querySelectorAll('.gantt-bar').length).toBeGreaterThan(5);
    expect(container.querySelectorAll('.gantt-dep-path').length).toBeGreaterThan(0);

    // tab Sumber Daya
    fireEvent.click(screen.getByRole('tab', { name: 'Sumber Daya' }));
    expect(screen.getByText('Sumber Daya Manusia')).toBeTruthy();
    expect(screen.getByText('Ayu Larasati')).toBeTruthy();

    // tab Kalender
    fireEvent.click(screen.getByRole('tab', { name: 'Kalender' }));
    expect(screen.getByText('Pengaturan Akhir Pekan')).toBeTruthy();
    expect(screen.getByText('Hari Libur Khusus')).toBeTruthy();

    // tab Analisis
    fireEvent.click(screen.getByRole('tab', { name: 'Analisis' }));
    expect(screen.getByText('Jalur Kritis (Critical Path)')).toBeTruthy();
    expect(screen.getByText('Estimasi PERT per Tugas')).toBeTruthy();
    expect(container.querySelector('.pert-svg')).toBeTruthy();
    expect(container.querySelectorAll('.chain-chip').length).toBeGreaterThan(0);

    // kembali ke Tugas
    fireEvent.click(screen.getByRole('tab', { name: 'Tugas' }));
    expect(screen.getByText('Daftar Tugas')).toBeTruthy();
  });
});
