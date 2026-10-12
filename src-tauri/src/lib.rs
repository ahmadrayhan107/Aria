pub mod commands;
pub mod db;
pub mod export;
pub mod parser;

use commands::AppState;
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_notification::NotificationExt;

const CAPTURE_SHORTCUT: (Modifiers, Code) = (Modifiers::CONTROL.union(Modifiers::ALT), Code::KeyN);
const REMINDER_INTERVAL: Duration = Duration::from_secs(15 * 60);

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Must match `additionalBrowserArgs` of the main window: all webviews share one WebView2 environment.
const BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --disable-gpu";

/// The capture window is created on demand and destroyed on close, so it costs no RAM while idle.
fn show_capture(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("capture") {
        let _ = w.show();
        let _ = w.set_focus();
        let _ = w.emit("capture-open", ());
        return;
    }
    let built = WebviewWindowBuilder::new(app, "capture", WebviewUrl::App("index.html?w=capture".into()))
        .title("Catat cepat")
        .inner_size(520.0, 132.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .center()
        .focused(true)
        .additional_browser_args(BROWSER_ARGS)
        .build();
    if let Err(e) = built {
        eprintln!("Gagal membuka jendela catat cepat: {e}");
    }
}

fn check_reminders(app: &AppHandle) {
    let state = app.state::<AppState>();
    let Ok(conn) = state.db.lock() else { return };
    let today = chrono::Local::now().date_naive();
    let Ok(due) = db::due_reminders(&conn, today) else { return };
    for (note, kind) in due {
        let title = if kind == "h" { "Tenggat hari ini" } else { "Tenggat besok" };
        let sent = app.notification().builder().title(title).body(&note.title).show();
        if sent.is_ok() {
            let _ = db::mark_reminded(&conn, &note, kind);
        }
    }
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Buka Aria", true, None::<&str>)?;
    let capture = MenuItem::with_id(app, "capture", "Catat cepat (Ctrl+Alt+N)", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Keluar", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &capture, &quit])?;
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("Aria")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id.as_ref() {
            "open" => show_main(app),
            "capture" => show_capture(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, e| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let shortcut = Shortcut::new(Some(CAPTURE_SHORTCUT.0), CAPTURE_SHORTCUT.1);
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_denylist(&["capture"])
                .build(),
        )
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, sc, event| {
                    if sc == &shortcut && event.state() == ShortcutState::Pressed {
                        show_capture(app);
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .setup(move |app| {
            let dir = app.path().data_dir()?.join("Aria");
            std::fs::create_dir_all(&dir)?;
            let conn = db::open(&dir.join("aria.db"))?;
            app.manage(AppState { db: Mutex::new(conn) });

            setup_tray(app.handle())?;
            if let Err(e) = app.global_shortcut().register(shortcut) {
                eprintln!("Gagal mendaftarkan Ctrl+Alt+N: {e}");
            }

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(5));
                loop {
                    check_reminders(&handle);
                    std::thread::sleep(REMINDER_INTERVAL);
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the main window hides it to the tray; quit from the tray menu.
            if let (WindowEvent::CloseRequested { api, .. }, "main") = (event, window.label()) {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::notes_list,
            commands::note_upsert,
            commands::note_move,
            commands::note_delete,
            commands::search,
            commands::tag_update,
            commands::tag_delete,
            commands::import_preview,
            commands::import_commit,
            commands::export_txt,
            commands::export_md,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aria");
}
