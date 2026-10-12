# Aria

A lightweight, offline desktop app for Windows that turns a single plain-text `Notes.txt` task list into a Kanban board with full-text search, quick capture and deadline reminders, and can write everything back to the original text format.

Built with Tauri v2, React 19 and SQLite (FTS5). The installer is about 2 MB and the app idles under 80 MB of RAM.

> The user interface is in Indonesian (Bahasa Indonesia). Code, comments and docs are in English.

## Table of contents

- [Why](#why)
- [Features](#features)
- [The Notes.txt format](#the-notestxt-format)
- [Install](#install)
- [Usage](#usage)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Build from source](#build-from-source)
- [Testing](#testing)
- [Performance](#performance)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Customizing tag rules](#customizing-tag-rules)
- [Data and privacy](#data-and-privacy)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)

## Why

Many people keep their work in one long text file: a "to do" section, a "done" section, and lines that drift between them. It is fast to write but hard to use. Projects get mixed, items land in the wrong section, and nothing can be searched or scheduled.

Aria imports that file once, keeps it in a local SQLite database, and gives it a proper board. When you need the text file again, export it. The output matches the original format line for line.

## Features

| Feature | Description |
|---|---|
| Import `Notes.txt` | Parses section headers into statuses (todo, ongoing, pending, done). Shows a preview with counts before anything is saved. Choose to replace or append. |
| Review flags | Lines that look misplaced get a **Perlu review** (needs review) badge. Examples: a done item that starts with "Belum dikerjakan:", or a status report sitting in the todo section. |
| Kanban board | Four columns with drag and drop between and within columns. Moving a card to Done records the completion time. |
| Automatic tags | Keyword rules tag each card with a project (for example `infra`, `recruitment`, `riset`). Tags can be edited, renamed, recolored, or created by hand. |
| Full-text search | SQLite FTS5 with prefix matching and ranking. Searches done items too. Opens as a command palette with `Ctrl+K`. |
| Detail panel | Edit title, body, status, due date, tags and a sub-checklist. Changes save automatically. |
| Copy as prompt | Copies a card (title, body and checklist) to the clipboard as Markdown, ready to paste into an AI assistant. |
| Quick capture | `Ctrl+Alt+N` opens a small always-on-top input from anywhere. Press Enter to add a todo. Works while the main window is hidden in the tray. |
| Due dates and reminders | Windows notifications one day before and on the due date. |
| Export | Write back to the `Notes.txt` format, or export done items in a date range as a Markdown report grouped by day. |
| Archive | Done items grouped by week or month, with tag filtering and one-click restore. |
| Theme | Light, dark, or follow Windows. Switch with the button in the titlebar or from the command palette. The choice is remembered. |
| Desktop integration | System tray, single instance, remembered window size and position. |
| Fully offline | No network calls, no CDN. Fonts and icons are bundled. |

## The Notes.txt format

Aria reads plain text with one section header per status and one item per line starting with `-`:

```text
List yang belum dikerjakan:
- set up the email server and a Cloudflare tunnel.
- write the payroll calculation guide. Include overtime rules.

List yang sudah dikerjakan:
- Notifikasi email/WA.
- Modul Aset.

List Pending:
- check arsitektur jaringan.

List Ongoing:
```

Section headers are matched by keyword and are case-insensitive:

| Header contains | Status |
|---|---|
| `belum dikerjakan` | Todo |
| `sudah dikerjakan` | Done |
| `pending` | Pending |
| `ongoing` | Ongoing |

Each item is split into a title (its first sentence, at most 120 characters) and a body (the rest). The split is reversible, so exporting gives back the original line. Checklist items you add in the app are exported inline as ` [x] text;` or ` [ ] text;` at the end of the line.

Both CRLF and LF line endings and a UTF-8 BOM are accepted. Exports use CRLF.

A complete sample file lives at [`src-tauri/tests/fixtures/Notes.txt`](src-tauri/tests/fixtures/Notes.txt). It contains fictional data and is used by the test suite.

## Install

Requirements: Windows 10 or 11 (64-bit) with the WebView2 runtime. WebView2 is preinstalled on Windows 11.

1. Download `Aria_<version>_x64-setup.exe` from the [Releases](https://github.com/ahmadrayhan107/Aria/releases) page, or build it yourself (see [Build from source](#build-from-source)).
2. Run the installer. It installs for the current user only and needs no administrator rights.
3. Start Aria from the Start menu.

The installer is not code-signed, so Windows SmartScreen may show a warning. Choose **More info**, then **Run anyway**.

## Usage

1. On first start the board is empty. Choose **Impor Notes.txt** and select your file.
2. Check the preview: counts per status and the list of flagged lines. Choose **Ganti semua** (replace) or **Tambahkan** (append), then confirm.
3. Work on the board. Drag cards between columns, click a card to open its detail panel, and use the sidebar to filter by tag or show only flagged cards.
4. Press `Ctrl+K` to search. Press `Ctrl+Alt+N` from any app to capture a new task.
5. Closing the window hides Aria to the tray, so reminders and quick capture keep working. To quit, right-click the tray icon and choose **Keluar**.
6. To get a text file back, open **Ekspor** in the sidebar and choose the `Notes.txt` format or a Markdown report for a date range.

## Keyboard shortcuts

| Shortcut | Where | Action |
|---|---|---|
| `Ctrl+Alt+N` | Anywhere in Windows | Open quick capture |
| `Ctrl+K` | Main window | Open search / command palette |
| `Up` / `Down`, `Enter` | Command palette | Move through results, open the selected card |
| `Enter` | Quick capture, quick add, tag and checklist inputs | Save |
| `Esc` | Dialogs, palette, quick capture, detail panel | Close |
| `Enter` | Focused card | Open its detail panel |

To change the theme from the keyboard, press `Ctrl+K` and type `tema`.

## Build from source

### Prerequisites

- [Bun](https://bun.sh) 1.3 or later
- [Rust](https://rustup.rs) stable with the MSVC toolchain (`x86_64-pc-windows-msvc`)
- Visual Studio 2022 Build Tools with the **Desktop development with C++** workload
- WebView2 runtime (preinstalled on Windows 11)

With winget:

```powershell
winget install Oven-sh.Bun Rustlang.Rustup
winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive"
```

### Commands

```powershell
git clone https://github.com/ahmadrayhan107/Aria.git
cd Aria
bun install

bun run tauri dev     # run the desktop app with hot reload
bun run tauri build   # release build and NSIS installer
```

The installer is written to `src-tauri/target/release/bundle/nsis/`.

| Command | What it does |
|---|---|
| `bun install` | Install frontend dependencies |
| `bun run dev` | Start only the Vite dev server at `http://localhost:1420` (see below) |
| `bun run tauri dev` | Run the desktop app in development mode |
| `bun run build` | Type-check and build the frontend into `dist/` |
| `bun run tauri build` | Release build and NSIS installer |
| `bun test` | Frontend unit tests |
| `cargo test --lib` (in `src-tauri/`) | Rust tests: parser, database, search, export |
| `ANALYZE=1 bun run build` | Bundle size report at `dist/stats.html` |

### UI development in a normal browser

`bun run dev` opened in a normal browser (outside Tauri) loads an in-memory mock of the backend from `src/dev/mock.ts`. Import reads the sample fixture, and all board, search and detail features work without Rust. The mock is only loaded in development and is never part of a production build.

## Testing

```powershell
bun test                       # 23 frontend tests
cd src-tauri; cargo test --lib # 17 Rust tests
```

The Rust tests cover:

- Parsing the sample file: 10 todo, 77 done, 1 pending, and exactly the misplaced lines flagged.
- Title splitting is reversible for every line.
- Export to `Notes.txt` and re-import give identical content.
- Markdown report date filtering and grouping.
- Database migrations, CRUD, tag handling, cascade deletes and reminder bookkeeping.
- Performance budgets: importing the sample file under 200 ms, and searching 5,000 cards under 50 ms.

The frontend tests cover the title splitter, tag rules (kept in sync with Rust), prompt formatting, date helpers, drag-and-drop index mapping, archive grouping and theme selection.

## Performance

Measured on a release build on Windows 11:

| Metric | Budget | Measured |
|---|---|---|
| Installer size (NSIS) | 8 MB or less | 2.2 MB |
| RAM at idle (private working set) | 80 MB or less | about 73 MB |
| Window visible after launch | 800 ms or less | about 300 ms |
| JavaScript bundle (gzip) | 150 KB or less | 112 KB |
| Import of 100 items | 200 ms or less | passes in tests |
| Search over 5,000 cards | 50 ms or less | passes in tests |

How the budgets are met:

- The quick capture window is created when the hotkey is pressed and destroyed when it closes. It uses no memory while idle.
- WebView2 GPU acceleration and several unused WebView2 features are turned off.
- No animation library. Motion uses CSS transitions on `transform` and `opacity` only.
- Release builds of the Rust side use LTO, size optimization, symbol stripping and `panic = "abort"`.

## Architecture

```
React UI (WebView2)
  Zustand store, optimistic updates
        |
        |  invoke()            "notes-changed" event
        v                              ^
Rust (Tauri v2)                        |
  commands.rs  ------------------------+
  parser.rs   Notes.txt -> items, title split, tags, review flags
  db.rs       SQLite + FTS5, migrations, ordering, reminders
  export.rs   items -> Notes.txt / Markdown
  lib.rs      tray, global shortcut, single instance, reminder thread
```

- **Storage:** SQLite through `rusqlite` with the bundled SQLite build. Schema versions are tracked with `PRAGMA user_version`. Full-text search uses an external-content FTS5 table kept in sync by triggers, ranked with BM25 (title weighted higher than body).
- **Commands:** `notes_list`, `note_upsert`, `note_move`, `note_delete`, `search`, `tag_update`, `tag_delete`, `import_preview`, `import_commit`, `export_txt`, `export_md`. Every write emits `notes-changed`, so the main window refreshes when quick capture adds a task.
- **Reminders:** a background thread checks due dates every 15 minutes and records sent reminders, so each one fires once.
- **Frontend:** React 19, TypeScript in strict mode, Vite, Tailwind CSS v4, `@dnd-kit` for drag and drop, Phosphor icons, and the Geist and Geist Mono fonts bundled locally.

Product requirements and design decisions are in [`docs/PRD.md`](docs/PRD.md) (in Indonesian).

## Project structure

```
src/
  app/            App shell, titlebar, sidebar
  features/
    board/        Kanban board, cards, quick add
    detail/       Detail panel (autosave, checklist, copy as prompt)
    search/       Command palette (Ctrl+K)
    capture/      Quick capture window (Ctrl+Alt+N)
    archive/      Done archive by week or month
    import/       Import preview and export dialogs
  components/     Shared UI pieces (dialog, toast, tag dot)
  store/          Zustand store
  lib/            API wrappers and pure utilities (unit tested)
  dev/            Browser-only backend mock
  assets/fonts/   Geist and Geist Mono (woff2)
src-tauri/
  src/            Rust: parser, db, export, commands, app setup
  tests/fixtures/ Sample Notes.txt (fictional data)
  capabilities/   Tauri permission set
  icons/          App icons (generated from source.svg)
docs/PRD.md       Product requirements
```

## Customizing tag rules

Automatic tags come from a keyword list. Single words match whole words only (so `tim` does not match `timeline`). Phrases such as `email server` match anywhere in the text.

The default rules:

| Tag | Keywords |
|---|---|
| `approval` | approval |
| `erp` | erp, payroll, invoice, gudang |
| `recruitment` | recruitment, pelamar, lamaran |
| `web` | website, landing, karir, seo |
| `infra` | nas, synology, cloudflare, dns, email server, tunnel, web-station |
| `riset` | research, riset, jetson, standar |
| `tim` | tim, team, talent |

The list exists twice: in `src-tauri/src/parser.rs` (`TAG_RULES`, used on import) and in `src/lib/tags.ts` (used by quick capture). Change both together. Default tag colors are in `TAG_COLORS` in `src-tauri/src/db.rs`. The title splitter is also duplicated (`split_title` in Rust, `splitTitle` in `src/lib/title.ts`), and tests on both sides check the same behavior.

## Data and privacy

- All data stays on your computer in `%APPDATA%\Aria\aria.db`.
- Aria makes no network requests, has no telemetry and no accounts.
- Your original `Notes.txt` is only read during import. It is never modified. Export always writes to a file you choose.
- To back up, copy `aria.db` while Aria is closed, or export to `Notes.txt`.
- To remove all data, uninstall Aria and delete the `%APPDATA%\Aria` folder.

## Known limitations

- Windows only. Tauri supports macOS and Linux, but the app has only been built and tested on Windows.
- The section header keywords and the review heuristics are in Indonesian.
- Import is one-way. Changes to `Notes.txt` after import are not synced automatically. Import again with **Tambahkan** or **Ganti semua**.
- Reminders only fire while Aria is running (in the window or the tray).
- The installer is not code-signed.

## Contributing

Issues and pull requests are welcome.

1. Fork the repository and create a branch.
2. Make your change. Keep the Rust and TypeScript copies of the tag rules and title splitter in sync.
3. Run `bun test`, `bun run build`, and `cargo test --lib` in `src-tauri/`. All must pass.
4. Open a pull request that describes the change and how you tested it.

Do not commit personal notes. Test data belongs in `src-tauri/tests/fixtures/` and must be fictional.

## License

[MIT](LICENSE)

Bundled third-party assets: the [Geist and Geist Mono](https://github.com/vercel/geist-font) fonts are licensed under the SIL Open Font License 1.1.
