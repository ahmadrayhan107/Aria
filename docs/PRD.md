# PRD — Aria (desktop note & task organizer)

## Context
Satu file `Notes.txt` (~100 baris) jadi satu-satunya tempat catat tugas: ~10 todo, ~75 done, 1 pending, 0 ongoing. Masalah:
- Semua proyek campur (approval/ERP, recruitment, website/karir, infra NAS/Cloudflare, riset, tim).
- Item panjang berupa prompt Claude Code multi-langkah (sebagian punya tenggat).
- Item salah tempat (laporan uji di bagian todo; item "Belum dikerjakan:" di bagian done).
- Tidak ada search, filter, deadline, atau riwayat kapan selesai.

Tujuan: app desktop lokal, sangat ringan, untuk impor Notes.txt lalu kelola sebagai papan Kanban + catatan yang cepat dicari.

Keputusan user: Tauri v2, React + TypeScript, bun (package manager + runner), impor sekali + ekspor manual ke Notes.txt, desain pakai skill `design-taste-frontend-v1`.

## Target user
Satu user (developer/lead IT), Windows 11, kerja banyak proyek paralel, sering salin catatan jadi prompt Claude Code.

## Scope v1 (MVP)
| # | Fitur | Detail |
|---|---|---|
| F1 | Impor Notes.txt | Parser baca judul bagian → status (`belum dikerjakan`→todo, `sudah dikerjakan`→done, `Pending`→pending, `Ongoing`→ongoing). Baris `- ...` → kartu. Item mencurigakan (diawali "Belum dikerjakan:", atau di todo tapi berbentuk laporan) diberi badge **Perlu review**. Dialog preview sebelum commit. |
| F2 | Papan Kanban | 4 kolom, drag-drop antar kolom & urut ulang. Pindah ke Done → set `done_at`. |
| F3 | Tag proyek otomatis | Aturan kata kunci: `approval`, `erp`, `recruitment`, `web` (website, landing, karir), `infra` (nas, synology, cloudflare, dns, email server, tunnel), `riset` (research, jetson, standar), `tim`. Editable manual; tag baru bisa dibuat. |
| F4 | Search full-text | SQLite FTS5, hasil instan (<50 ms) termasuk Done. Command palette `Ctrl+K`. |
| F5 | Kartu detail | Judul (kalimat pertama, editable), body, sub-checklist, tag, deadline, tanggal dibuat/selesai. Panel samping, bukan modal penuh. |
| F6 | Copy as prompt | Satu klik salin judul + body + checklist sebagai teks Markdown ke clipboard. |
| F7 | Quick capture | Hotkey global `Ctrl+Alt+N` + tray icon → jendela input kecil, Enter simpan ke Todo. |
| F8 | Deadline & reminder | Set due date; notifikasi Windows H-1 dan hari-H (cek saat app/tray hidup). |
| F9 | Ekspor Notes.txt | Tulis balik format asli (4 bagian, urutan sama). Juga ekspor Done per rentang tanggal sebagai Markdown untuk laporan atasan. |
| F10 | Arsip Done | Tampilan list dikelompokkan per minggu/bulan, filter tag. |

**Di luar scope v1:** sync cloud, multi-user, mobile, sync dua arah otomatis dengan Notes.txt, AI auto-kategorisasi.

## Requirement non-fungsional (prioritas: ringan)
| Metrik | Target |
|---|---|
| Installer (NSIS/MSI) | ≤ 8 MB |
| RAM idle (proses app + WebView2) | ≤ 80 MB |
| Cold start ke UI interaktif | ≤ 800 ms |
| JS bundle (gzip) | ≤ 150 KB |
| Impor 100 item | ≤ 200 ms |
| Search | ≤ 50 ms untuk 5.000 kartu |
| Offline penuh | Ya, tanpa CDN (font & ikon di-bundle) |

## Stack & arsitektur
- **Shell:** Tauri v2 (WebView2 bawaan Windows). Rust layer tipis, hanya command DB + plugin.
- **Plugin resmi Tauri:** `global-shortcut`, `notification`, `dialog` (pilih file impor/ekspor), `clipboard-manager`, `fs`, `single-instance`, `window-state`. Tray via API core `tray`.
- **DB:** SQLite via `rusqlite` (feature `bundled`, FTS5) di sisi Rust; file di `%APPDATA%\Aria\aria.db`. Command Tauri: `notes_list`, `note_upsert`, `note_move`, `note_delete`, `search`, `import_preview`, `import_commit`, `export_txt`, `export_md`. Parser Notes.txt di Rust (cepat + teruji `cargo test`).
- **Frontend:** React 19 + TypeScript strict, Vite, **bun** untuk `bun install`, `bun run dev`, `bun run build`, `bun test` (unit test util frontend).
- **State:** Zustand (≈1 KB) untuk store kartu; tanpa React Query (data lokal).
- **Styling:** Tailwind CSS v4 via `@tailwindcss/vite`.
- **Drag-drop:** `@dnd-kit/core` + `@dnd-kit/sortable`.
- **Ikon:** `@phosphor-icons/react` (import per ikon, tree-shake), stroke konsisten.
- **Font:** Geist + Geist Mono, file `.woff2` lokal di `src/assets/fonts`.
- **Motion:** CSS transition saja (tanpa Framer Motion, hemat ~40 KB). Animasi hanya `transform`/`opacity`.

### Model data
```
notes(id, title, body, status, position, needs_review, created_at, updated_at, done_at, due_at, source_line)
checklist_items(id, note_id, text, done, position)
tags(id, name, color)
note_tags(note_id, tag_id)
notes_fts (FTS5: title, body) + trigger sinkron
```

### Struktur folder (rencana)
```
aria/
  docs/PRD.md              ← PRD ini
  src/                     ← React
    app/ components/ features/{board,detail,search,capture,archive,import}/ store/ lib/ assets/fonts/
  src-tauri/
    src/{main.rs, db.rs, parser.rs, export.rs, commands.rs}
    tauri.conf.json
  package.json  bun.lock  vite.config.ts  tsconfig.json
```

## Arah desain (skill design-taste-frontend-v1, disesuaikan untuk tool produktivitas desktop)
- Dial: **VARIANCE 5, MOTION 3, DENSITY 6** (app kerja harian, bukan landing page; motion rendah demi ringan).
- Palet: base **Zinc** netral, satu aksen **Emerald desaturasi**. Tanpa ungu/neon/gradient teks. Off-black `zinc-950` untuk dark mode; ikut tema sistem Windows.
- Tipografi: Geist untuk UI, Geist Mono untuk angka, tanggal, ID. Tanpa Inter, tanpa serif.
- Layout: sidebar kiri sempit (tag/proyek + hitungan), papan Kanban tengah, panel detail kanan geser. Kolom asimetris: Todo & Ongoing lebih lebar dari Pending & Done.
- Kartu Kanban: border 1px, tanpa shadow berat; pemisah pakai `divide-y`/negative space. Tag sebagai titik warna kecil + teks.
- State wajib: skeleton saat load, empty state berisi tombol "Impor Notes.txt" + hint hotkey, error inline di form, feedback `:active scale-[0.98]`.
- Tanpa emoji; ikon Phosphor saja. Copy UI dalam Bahasa Indonesia, kata kerja konkret.
- Window: custom titlebar tipis (`decorations: false` + drag region), ukuran minimum 960×600.

## Tahap implementasi
1. **Scaffold:** `bun create tauri-app` (React-TS, bun), set Tailwind v4, font, ikon, struktur folder, salin PRD ke `docs/PRD.md`.
2. **Core data:** `db.rs` schema + migrasi, `parser.rs` + `cargo test` pakai fixture `Notes.txt`, command CRUD + FTS.
3. **UI board:** layout, Kanban + dnd-kit, store Zustand, panel detail, checklist.
4. **Impor/ekspor:** dialog preview impor, badge Perlu review, ekspor txt/md.
5. **Desktop extra:** tray, hotkey quick capture, notifikasi deadline, single-instance, window-state.
6. **Polish & budget:** audit bundle (`vite build` + `rollup-plugin-visualizer` sekali jalan), ukur RAM/startup, release build `bun run tauri build`.

## Verifikasi
- `cargo test` di `src-tauri`: parser menghasilkan 10 todo / 77 done / 1 pending dari fixture `src-tauri/tests/fixtures/Notes.txt`, item salah tempat ditandai needs_review; ekspor → impor ulang menghasilkan isi identik (round-trip).
- `bun test`: util frontend (pemecah judul, aturan tag).
- `bun run tauri dev`: uji manual — impor, drag kartu ke Done (done_at terisi), search `Ctrl+K` "cloudflare", quick capture `Ctrl+Alt+N` saat app di tray, copy as prompt, notifikasi deadline.
- `bun run tauri build`: cek ukuran installer ≤ 8 MB; Task Manager RAM idle ≤ 80 MB; startup ≤ 800 ms.
