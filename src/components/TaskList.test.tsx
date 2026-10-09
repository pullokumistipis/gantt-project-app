import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProjectProvider } from '../state/ProjectContext';
import { createSeedData } from '../utils/seed';
import { TaskList } from './TaskList';

afterEach(cleanup);

function renderList() {
  return render(
    <ProjectProvider initialData={createSeedData()}>
      <TaskList />
    </ProjectProvider>,
  );
}

describe('TaskList', () => {
  it('menampilkan tugas, prioritas, dan penanda jalur kritis dari data contoh', () => {
    renderList();

    expect(screen.getByText('Analisis Kebutuhan')).toBeTruthy();
    expect(screen.getByText('Fase 1 — Perencanaan')).toBeTruthy();
    expect(screen.getByText('Deployment & Rilis')).toBeTruthy();
    expect(screen.getAllByText('KP').length).toBeGreaterThan(0); // jalur kritis
    expect(screen.getByText('+ Tugas Baru')).toBeTruthy();
  });

  it('menyaring tugas lewat pencarian', () => {
    renderList();
    const search = screen.getByLabelText('Cari tugas');

    fireEvent.change(search, { target: { value: 'Pengujian QA' } });
    expect(screen.getByText('Pengujian QA')).toBeTruthy();
    expect(screen.queryByText('Wireframe & Desain UI')).toBeNull();

    fireEvent.change(search, { target: { value: 'tidak-ada' } });
    expect(screen.getByText('Tidak ada tugas yang cocok.')).toBeTruthy();
  });

  it('menambah tugas baru lewat form', () => {
    renderList();

    fireEvent.click(screen.getByText('+ Tugas Baru'));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Nama tugas *'), { target: { value: 'Tugas Uji Manual' } });
    fireEvent.change(screen.getByLabelText(/Durasi/), { target: { value: '5' } });
    fireEvent.click(screen.getByText('Tambah Tugas'));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Tugas Uji Manual')).toBeTruthy();
  });

  it('menolak nama kosong dan menampilkan error', () => {
    renderList();
    fireEvent.click(screen.getByText('+ Tugas Baru'));
    fireEvent.click(screen.getByText('Tambah Tugas'));

    expect(screen.getByRole('alert').textContent).toContain('Nama tugas wajib diisi');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('membuka form edit berisi dependensi FS/SS yang tersimpan', () => {
    renderList();

    fireEvent.click(screen.getByLabelText('Edit Dokumen Spesifikasi'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByLabelText('Nama tugas *')).toHaveProperty('value', 'Dokumen Spesifikasi');
    expect(screen.getByText('FS (Finish→Start)')).toBeTruthy();
    expect(screen.getByLabelText('Jeda hari (lag)')).toHaveProperty('value', '0');
    expect(screen.getByText('Simpan Perubahan')).toBeTruthy();
  });

  it('menghapus tugas setelah konfirmasi', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderList();

    fireEvent.click(screen.getByLabelText('Hapus Deployment & Rilis'));
    expect(screen.queryByText('Deployment & Rilis')).toBeNull();
    expect(confirmSpy).toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('membuat sub-tugas pada induk yang dipilih', () => {
    renderList();

    fireEvent.click(screen.getByLabelText('Tambah sub-tugas di Analisis Kebutuhan'));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Nama tugas *'), { target: { value: 'Sub-tugas Baru' } });
    const parentSelect = screen.getByLabelText(/Induk tugas/);
    expect(parentSelect).toHaveProperty('value', 't1_1');

    fireEvent.click(screen.getByText('Tambah Tugas'));
    expect(screen.getByText('Sub-tugas Baru')).toBeTruthy();
  });
});
