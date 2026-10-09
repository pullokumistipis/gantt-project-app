import { describe, expect, it } from 'vitest';
import type { CalendarConfig } from '../types';
import {
  addDays,
  addWorkingDays,
  dateToIndex,
  formatDateID,
  indexToDate,
  isValidISO,
  isWeekendDay,
  isWorkingDay,
  lastWorkingIndexOnOrBefore,
  workingDaysInclusive,
} from './dates';

/**
 * 2026-01-01 = Kamis, 2026-01-03 = Sabtu, 2026-01-04 = Minggu,
 * 2026-01-05 = Senin.
 */
const cal: CalendarConfig = {
  weekendDays: [0, 6],
  holidays: [{ id: 'h1', date: '2026-01-01', name: 'Tahun Baru' }],
};

describe('dates', () => {
  it('mengenali akhir pekan dan hari libur', () => {
    expect(isWeekendDay('2026-01-03', cal)).toBe(true); // Sabtu
    expect(isWeekendDay('2026-01-04', cal)).toBe(true); // Minggu
    expect(isWeekendDay('2026-01-05', cal)).toBe(false); // Senin
    expect(isWorkingDay('2026-01-02', cal)).toBe(true); // Jumat
    expect(isWorkingDay('2026-01-01', cal)).toBe(false); // libur
    expect(isWorkingDay('2026-01-03', cal)).toBe(false); // sabtu
  });

  it('mengvalidasi format ISO', () => {
    expect(isValidISO('2026-01-05')).toBe(true);
    expect(isValidISO('2026-02-30')).toBe(false);
    expect(isValidISO('2026-1-5')).toBe(false);
    expect(isValidISO('bukan-tanggal')).toBe(false);
    expect(isValidISO(42)).toBe(false);
  });

  it('indeks hari kerja dapat dibalik bolak-balik', () => {
    for (const iso of ['2026-01-02', '2026-01-05', '2026-01-16', '2026-02-02']) {
      const index = dateToIndex(iso, cal);
      expect(indexToDate(index, cal)).toBe(iso);
    }
  });

  it('menjorok ke hari kerja berikutnya untuk tanggal non-kerja', () => {
    // Minggu -> Senin
    expect(dateToIndex('2026-01-04', cal)).toBe(dateToIndex('2026-01-05', cal));
    // hari libur Kamis -> Jumat
    expect(dateToIndex('2026-01-01', cal)).toBe(dateToIndex('2026-01-02', cal));
    expect(indexToDate(0, cal)).toBe('2000-01-03'); // hari kerja pertama setelah epoch (Sabtu 2000-01-01)
  });

  it('menambah hari kerja melewati akhir pekan', () => {
    expect(addWorkingDays('2026-01-02', 0, cal)).toBe('2026-01-02'); // Jumat
    expect(addWorkingDays('2026-01-02', 1, cal)).toBe('2026-01-05'); // Jumat + 1 = Senin
    expect(addWorkingDays('2026-01-05', 5, cal)).toBe('2026-01-12'); // Senin + 5 = Senin depan
    expect(addWorkingDays('2026-01-02', -1, cal)).toBe('2025-12-31'); // Jumat - 1, lewati libur 1 Jan -> Rabu
  });

  it('menghitung durasi hanya hari kerja', () => {
    // Jumat s/d Selasa = Jumat, Senin, Selasa
    expect(workingDaysInclusive('2026-01-02', '2026-01-06', cal)).toBe(3);
    // murni akhir pekan
    expect(workingDaysInclusive('2026-01-03', '2026-01-04', cal)).toBe(0);
    // melewati hari libur 1 Jan
    expect(workingDaysInclusive('2025-12-31', '2026-01-02', cal)).toBe(2);
    // tanggal mundur = 0
    expect(workingDaysInclusive('2026-01-06', '2026-01-02', cal)).toBe(0);
  });

  it('indeks hari kerja terakhir <= tanggal', () => {
    expect(indexToDate(lastWorkingIndexOnOrBefore('2026-01-04', cal), cal)).toBe('2026-01-02');
    expect(indexToDate(lastWorkingIndexOnOrBefore('2026-01-05', cal), cal)).toBe('2026-01-05');
  });

  it('menghitung beda hari kalender', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('format tanggal Indonesia', () => {
    expect(formatDateID('2026-01-05')).toBe('05 Jan 2026');
    expect(formatDateID('2026-12-31')).toBe('31 Des 2026');
  });

  it('mendukung konfigurasi akhir pekan lain', () => {
    const custom: CalendarConfig = { weekendDays: [1, 2], holidays: [] }; // Senin & Selasa libur
    expect(isWorkingDay('2026-01-05', custom)).toBe(false); // Senin
    expect(isWorkingDay('2026-01-07', custom)).toBe(true); // Rabu
    expect(indexToDate(0, custom)).toBe('2000-01-01'); // Sabtu tetap hari kerja
    expect(addWorkingDays('2026-01-04', 1, custom)).toBe('2026-01-07'); // Minggu + 1 = Rabu
  });
});
