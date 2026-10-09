# GanttPro — Aplikasi Manajemen Proyek Gantt Chart

Aplikasi manajemen proyek berbasis **Gantt Chart** yang dibangun dengan **React + TypeScript + Vite**.
Seluruh data disimpan di `localStorage` dan dilengkapi data contoh (seed) berisi proyek
“Peluncuran Aplikasi Mobile”.

## Fitur

1. **Manajemen Tugas**
   - Tambah / edit / hapus tugas (CRUD) lewat modal form.
   - Durasi dalam **hari kerja**, tanggal mulai, prioritas (Low / Medium / High), warna indikator bar,
     progres 0–100 %.
   - Sub-tugas (parent–child) dengan indentasi, collapse/expand, dan promosi anak saat induk dihapus.
2. **Predecessors & Tampilan Timeline**
   - Hubungan **Finish-to-Start (FS)** dan **Start-to-Start (SS)** beserta **jeda hari (lag)**.
   - Grafik Gantt: bar tugas (warna + progres), **panah dependensi**, **drag** untuk memindahkan bar dan
     **resize** tepi kiri/kanan bar untuk mengubah durasi, zoom Harian/Pekan/Bulan, penanda hari ini.
   - Batang hanya pernah jatuh pada hari kerja (snapping ke hari kerja terakhir saat pointer melewati
     akhir pekan/libur).
3. **Manajemen Sumber Daya**
   - Pendaftaran anggota tim: nama, email, peran, gaji (Rp/bulan).
   - Alokasi anggota ke tugas tertentu (multi-select pada form tugas), ringkasan beban kerja per anggota.
4. **Kalender Proyek**
   - Pengaturan akhir pekan (pilih hari Minggu–Sabtu, minimal satu hari kerja).
   - Hari libur khusus (custom holiday) — tanggal + nama, bisa ditambah/dihapus.
   - Semua perhitungan durasi & jadwal **hanya menghitung hari kerja** (akhir pekan & hari libur dilewati).
5. **Analisis Proyek**
   - **Critical Path (CPM)**: forward/backward pass, slack, daftar & tabel jalur kritis, sorotan merah di Gantt.
   - **Diagram PERT**: jaringan tugas (node + panah), estimasi O/M/P, E = (O + 4M + P)/6, σ = (P − O)/6,
     varian, serta estimasi durasi proyek ± simpangan baku.

## Teknologi

| Bagian      | Teknologi                                  |
| ----------- | ------------------------------------------ |
| UI          | React 18 + TypeScript 5.6                  |
| Build       | Vite 5                                     |
| State       | React Context + hooks (tanpa library ekstra)|
| Persistensi | `localStorage`                             |
| Test        | Vitest + Testing Library (jsdom)           |

## Cara Install & Menjalankan

```bash
# 1. install dependensi
npm install

# 2. jalankan mode development (hot reload)
npm run dev
# buka http://localhost:5173

# 3. typecheck TypeScript
npm run typecheck

# 4. jalankan seluruh unit & component test
npm test

# 5. build produksi ke folder dist/
npm run build

# 6. pratinjau hasil build
npm run preview
# buka http://localhost:4173
```

Semua perintah di atas harus lolos tanpa error sebelum di-commit.

## Struktur Proyek

```
src/
├── main.tsx                 # entry point React
├── App.tsx                  # shell: header, tab navigasi, routing antar tampilan
├── styles.css               # seluruh style (responsif)
├── types.ts                 # tipe domain: Task, Member, CalendarConfig, dll.
├── state/
│   └── ProjectContext.tsx   # store + aksi CRUD, persistensi ke localStorage
├── utils/
│   ├── dates.ts             # matematika hari kerja (indeks hari kerja, libur, format)
│   ├── scheduling.ts        # mesin CPM: forward/backward pass, jalur kritis, PERT
│   ├── taskUtils.ts         # pohon tugas, deteksi siklus, hapus berantai
│   ├── seed.ts              # data contoh
│   ├── storage.ts           # load/save/validasi localStorage
│   └── format.ts            # format rupiah & angka
├── components/
│   ├── TaskList.tsx         # tabel tugas (pencarian, aksi CRUD)
│   ├── TaskForm.tsx         # form tambah/edit: dependensi, alokasi, PERT
│   ├── GanttChart.tsx       # timeline Gantt: bar, panah, drag/resize, zoom
│   ├── ResourcesView.tsx    # manajemen anggota tim + beban kerja
│   ├── CalendarView.tsx     # akhir pekan & hari libur
│   ├── AnalysisView.tsx     # jalur kritis + tabel PERT
│   ├── PertDiagram.tsx      # diagram jaringan PERT (SVG)
│   └── common.tsx           # Modal, badge prioritas, field form
└── *.test.ts(x)             # unit & component test (vitest)
```

## Cara Kerja Penjadwalan

- **Kalender hari kerja**: tanggal dikonversi ke *indeks hari kerja* (urutan hari kerja sejak 2000-01-01),
  sehingga penjumlahan durasi/lag murni dalam satuan hari kerja. Akhir pekan dan hari libur otomatis
  dilewati, tanggal non-kerja di-*snap* ke hari kerja berikutnya.
- **Forward pass (CPM)**: `ES = max(tanggal mulai manual, batas dari predecessor)`
  - FS: `ES_penerima ≥ ES_pengirim + durasi + lag`
  - SS: `ES_penerima ≥ ES_pengirim + lag`
- **Backward pass**: latest start dihitung dari penerus, `slack = LS − ES`, dan `slack = 0` berarti
  berada di **jalur kritis** (disorot merah di Gantt dan tabel analisis).
- **Tanggal mulai manual** berperan sebagai *batas paling awal*: menarik bar ke kanan (menunda) selalu
  bisa, tetapi menarik bar melewati batas predecessor akan kembali ke posisi yang diizinkan dependensi.
  Ubah lewat **resize** atau geser predecessor-nya untuk memindahkan seluruh rantai.
- **PERT** menghitung ulang jaringan dengan durasi ekspektasi `E = (O + 4M + P)/6` lalu mengukur
  variannya di sepanjang jalur kritis hasil PERT.

## Penyimpanan Data

- Kunci `localStorage`: `ganttpro.project.v1` (otomatis tersimpan setiap kali data berubah).
- Saat pertama dibuka (atau data rusak/tidak valid), aplikasi membuat **data contoh**.
- Tombol **“Reset data contoh”** di header mengembalikan seluruh data ke seed awal.
- Struktur data divalidasi saat dimuat (`isValidProjectData`): referensi dependensi, induk tugas, dan
  anggota wajib menunjuk ke entitas yang ada.

## Test

```bash
npm test           # jalankan sekali
npm run test:watch # mode watch
```

Cakupan test:

- `dates.test.ts` — hari kerja, akhir pekan, hari libur, indeks bolak-balik, snap non-kerja.
- `scheduling.test.ts` — FS/SS + lag, batas manual, slack & jalur kritis, deteksi siklus, PERT.
- `seed.test.ts` — integritas data contoh, konsistensi jadwal, validasi penyimpanan.
- `TaskList.test.tsx` — render, pencarian, tambah/edit/hapus tugas, sub-tugas, validasi form.
- `GanttChart.test.tsx` — bar, panah dependensi, zoom, sorotan jalur kritis, pemilihan baris.
