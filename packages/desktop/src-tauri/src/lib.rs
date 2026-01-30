use tauri_plugin_sql::{Migration, MigrationKind};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
    image::Image,
};
use std::sync::atomic::{AtomicBool, Ordering};

// Define the application status to track whether a real exit operation is being performed
struct AppState {
    is_quitting: AtomicBool,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: r#"
                -- Lists table
                CREATE TABLE IF NOT EXISTS lists (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    icon TEXT,
                    color TEXT,
                    "order" INTEGER,
                    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
                    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
                );

                -- Tasks table
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    completed INTEGER NOT NULL DEFAULT 0,
                    completed_at INTEGER,
                    complete_percentage INTEGER,
                    due_date INTEGER,
                    list_id TEXT,
                    list_name TEXT NOT NULL,
                    content TEXT,
                    "order" INTEGER NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    tags TEXT, -- JSON array
                    priority INTEGER,
                    group_category TEXT NOT NULL DEFAULT 'nodate',
                    FOREIGN KEY (list_id) REFERENCES lists (id) ON DELETE SET NULL
                );

                -- Subtasks table
                CREATE TABLE IF NOT EXISTS subtasks (
                    id TEXT PRIMARY KEY,
                    parent_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    completed INTEGER NOT NULL DEFAULT 0,
                    completed_at INTEGER,
                    due_date INTEGER,
                    "order" INTEGER NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    FOREIGN KEY (parent_id) REFERENCES tasks (id) ON DELETE CASCADE
                );

                -- Summaries table
                CREATE TABLE IF NOT EXISTS summaries (
                    id TEXT PRIMARY KEY,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    period_key TEXT NOT NULL,
                    list_key TEXT NOT NULL,
                    task_ids TEXT NOT NULL, -- JSON array
                    summary_text TEXT NOT NULL
                );

                -- Settings table
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
                );

                -- Insert default data
                INSERT OR IGNORE INTO lists (id, name, icon, "order")
                VALUES ('inbox-default', 'Inbox', 'inbox', 1);

                INSERT OR IGNORE INTO settings (key, value) VALUES
                ('appearance', '{"themeId":"default-coral","darkMode":"system","interfaceDensity":"default"}'),
                ('preferences', '{"language":"zh-CN","defaultNewTaskDueDate":null,"defaultNewTaskPriority":null,"defaultNewTaskList":"Inbox","confirmDeletions":true}'),
                ('ai', '{"provider":"openai","apiKey":"","model":"","baseUrl":"","availableModels":[]}');

                -- Create indexes
                CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id);
                CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
                CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
                CREATE INDEX IF NOT EXISTS idx_subtasks_parent_id ON subtasks(parent_id);
                CREATE INDEX IF NOT EXISTS idx_summaries_period_list ON summaries(period_key, list_key);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_echo_reports",
            sql: r#"
                -- Echo Reports table
                CREATE TABLE IF NOT EXISTS echo_reports (
                    id TEXT PRIMARY KEY,
                    created_at INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    job_types TEXT NOT NULL, -- JSON array
                    style TEXT NOT NULL,
                    user_input TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_echo_reports_created_at ON echo_reports(created_at);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_user_profile",
            sql: r#"
                -- User Profile table for onboarding and personalization
                CREATE TABLE IF NOT EXISTS user_profile (
                    id TEXT PRIMARY KEY DEFAULT 'default',
                    persona TEXT,                    -- JSON array of persona types
                    task_view TEXT,                  -- 'process' | 'outcome' | null
                    uncertainty_tolerance TEXT,     -- 'low' | 'high' | null
                    incompletion_style TEXT,        -- 'narrative' | 'explicit' | null
                    wrm_confidence TEXT,            -- JSON: {taskView, uncertaintyTolerance, incompletionStyle}
                    user_note TEXT,
                    onboarding_completed INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                -- Insert default profile
                INSERT OR IGNORE INTO user_profile (id, onboarding_completed, created_at, updated_at)
                VALUES ('default', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);
            "#,
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .manage(AppState {
            is_quitting: AtomicBool::new(false),
        })
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:tada.db", migrations)
                .build(),
        )
        .setup(|app| {
            // Create a tray menu
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Tada", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let icon_bytes = include_bytes!("../icons/tray-icon.png");
            let icon = Image::from_bytes(icon_bytes).expect("Failed to load tray icon");

            // Build the tray icon
            let tray_builder = TrayIconBuilder::with_id("tray")
                .menu(&menu)
                .icon(icon)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        // User clicked the exit button of the tray
                        let state = app.state::<AppState>();
                        state.is_quitting.store(true, Ordering::Relaxed);
                        app.exit(0);
                    }
                    "show" => {
                        // User clicked "Display"
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    // Left-click the tray icon on Windows/Linux to display the window
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } => {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                });

            #[cfg(target_os = "macos")]
            let tray_builder = tray_builder.icon_as_template(true);

            tray_builder.build(app)?;

            Ok(())
        })
        // Handle window events (block the close button)
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let app_handle = window.app_handle();
                let state = app_handle.state::<AppState>();

                // If it is not exited through the Quit button on the tray or Cmd+Q (which triggers the App Exit process), it will be blocked and hidden
                if !state.is_quitting.load(Ordering::Relaxed) {
                    api.prevent_close();
                    window.hide().unwrap();
                }
            }
        })
        // .plugin(tauri_plugin_updater::Builder::new().build())
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            // To handle macOS, click the Dock icon to reopen the window
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen { .. } => {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        });
}