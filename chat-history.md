# Chat History — GanttPro (Manajemen Proyek Gantt Chart)

Sesi pengembangan aplikasi dengan **Buffy (Codebuff)** — 10 Oktober 2026
Proyek: `C:/Users/fauzi/gantt-project-app` · Stack: React 18 + TypeScript 5.6 + Vite 5 + Vitest

---

## 1. Urutan Permintaan & Hasil

| # | Permintaan | Hasil |
|---|------------|-------|
| 1 | Buat aplikasi Manajemen Proyek berbasis Gantt Chart lengkap (task management, predecessors FS/SS + lag, resource, kalender hari kerja, critical path & PERT, localStorage + seed, .gitignore, README, typecheck/test/build lolos) | Diimplementasikan penuh: 32 file sumber, 5 tab UI, mesin CPM + PERT, 44 unit/component test |
| 2 | Jalankan `npm install`, typecheck, test, build; perbaiki semua error; jalankan `npm run dev` dan beri tahu URL-nya | Semua exit 0 tanpa error tersisa; dev server → **http://localhost:5173/** (HTTP 200) |
| 3 | Pastikan `.gitignore` (node_modules, dist), README.md (fitur/install/jalankan), tidak ada file rahasia/token | Terverifikasi: `.gitignore` lengkap; README punya seksi Fitur & Cara Install; hanya file tersembunyi `.gitignore`; pemindaian pola rahasia bersih |
| 4 | Inisialisasi git, commit pertama "Initial commit: Gantt Chart project management app", branch `main`, remote `origin`, push ke GitHub | Selesai: commit `5373267` (32 file), push sukses, diverifikasi `git ls-remote` menunjuk SHA sama di `https://github.com/pullokumistipis/gantt-project-app.git` |
| 5 | Buat `chat-history.md` dan push ke GitHub | File ini, di-commit & di-push pada commit berikutnya |

---

## 2. Fitur yang Dibangun

1. **Manajemen Tugas** — CRUD lewat modal, durasi hari kerja, tanggal mulai, prioritas Low/Medium/High (badge), warna indikator bar (color picker + swatch), progres, sub-tugas parent–child (indent, collapse/expand, promosi anak saat induk dihapus).
2. **Predecessors & Timeline** — hubungan **FS** dan **SS** dengan **lag hari kerja** (validasi anti-siklus), Gantt chart: bar + progres, panah dependensi SVG (merah saat jalur kritis), **drag pindah & resize** tepi bar dengan snapping hari kerja, zoom Harian/Pekan/Bulan, penanda hari ini, sorot jalur kritis.
3. **Sumber Daya** — anggota (nama, email, peran, gaji Rp), alokasi multi-anggota per tugas, kartu beban kerja per anggota.
4. **Kalender Proyek** — toggle akhir pekan per hari (min. 1 hari kerja), hari libur khusus, ringkasan rentang & hari kerja.
5. **Analisis** — Critical Path (forward/backward pass, slack, tabel + rantai jalur kritis, sorotan di Gantt) dan Diagram PERT (jaringan SVG, E = (O+4M+P)/6, σ = (P−O)/6, varian, estimasi proyek ±2σ).

---

## 3. Keputusan Desain Penting

- **Kalender berbasis indeks hari kerja** (`src/utils/dates.ts`): tanggal dikonversi ke urutan hari kerja sejak epoch `2000-01-01`, sehingga penjumlahan durasi/lag murni satuan hari kerja; akhir pekan & hari libur dilewati; tanggal non-kerja di-snap ke hari kerja berikutnya; daftar hari kerja di-cache per konfigurasi kalender.
- **Penjadwalan CPM** (`src/utils/scheduling.ts`):
  - Forward pass: `ES = max(tanggal mulai manual, batas predecessor)`; FS → `ES_penerima ≥ EF_pengirim + 1 + lag`; SS → `ES_penerima ≥ ES_pengirim + lag`.
  - Backward pass menghitung *latest start* dari penerus; `slack = LS − ES`; `slack = 0` = jalur kritis.
  - Siklus terdeteksi via Kahn's algorithm (tidak menggantung; dilaporkan `hasCycle`).
- **Semantik drag**: menarik bar ke kanan selalu bisa; menarik melewati batas predecessor kembali ke posisi yang diizinkan (tanggal mulai = *earliest-start constraint*). Dijelaskan di README.
- **Parent–child bersifat organisasi**: induk tetap tugas biasa (semua field bisa diedit); pada seed data, bar induk di-*align* agar menaungi sub-tugas (`stabilizeSeed`).
- **Persistensi**: `localStorage` kunci `ganttpro.project.v1`, divalidasi strukturnya saat load (`isValidProjectData` + `normalizeProjectData`), fallback ke seed bila rusak; tombol "Reset data contoh" di header.
- **Layering Gantt**: baris statis + kolom `z-index 0`, panah `z 2`, sel kiri sticky `z 4`, header sticky `z 5` — panel kiri tidak tertimpa panah saat scroll horizontal.

---

## 4. Verifikasi (exit status ditangkap via `pipefail`)

| Perintah | Exit | Hasil |
|---|---|---|
| `npm install` | 0 | up to date |
| `npm run typecheck` (`tsc --noEmit`, strict) | 0 | bersih |
| `npm test` (Vitest + Testing Library) | 0 | **44/44 test, 6 file** |
| `npm run build` | 0 | `dist/` → JS 199,78 kB + CSS 17,60 kB |
| Smoke test Chrome headless (`vite preview`) | 0 | render penuh, tanpa error konsol |
| `git push` + `git ls-remote` | 0 | SHA remote = SHA lokal |

**Test:** `dates.test.ts` (hari kerja/libur/indeks), `scheduling.test.ts` (FS/SS+lag, slack, siklus, PERT), `seed.test.ts` (integritas data contoh + storage), `TaskList.test.tsx` (render/cari/tambah/edit/hapus/sub-tugas), `GanttChart.test.tsx` (bar/panah/zoom/highlight), `App.test.tsx` (navigasi 5 tab).

**Error yang muncul selama pengembangan (diperbaiki pada penyebabnya, tidak di-skip):**
1. 3 assertion test dengan ekspektasi salah (urutan topologi Kahn, hari kerja mundur melewati libur, tautan logika).
2. DOM duplikat di Testing Library karena auto-cleanup tidak aktif dengan `globals: false` → ditambahkan `afterEach(cleanup)`.
3. TypeScript TS2783 (properti `id` duplikat pada helper test) → baris eksplisit dihapus.

---

## 5. Struktur Repo

```
.gitignore  README.md  chat-history.md  index.html
package.json  package-lock.json  tsconfig.json  vite.config.ts
src/
├── main.tsx · App.tsx (+ App.test) · styles.css · types.ts
├── state/ProjectContext.tsx
├── utils/ dates · scheduling · taskUtils · seed · storage · format (+ .test)
└── components/ TaskList · TaskForm · GanttChart · ResourcesView
                CalendarView · AnalysisView · PertDiagram · common (+ .test)
```

---

## 6. Keterbatasan

- Interaksi drag/resize diuji lewat logika unit + render, bukan otomasi browser penuh (jsdom tanpa pointer capture).
- Layout responsif diverifikasi struktural (media query + DOM headless), bukan uji piksel.
- Tanpa backend/API — seluruh data di localStorage peramban.
