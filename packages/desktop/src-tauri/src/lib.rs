use tauri_plugin_sql::{Migration, MigrationKind};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent, Emitter,
    image::Image,
};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use chrono::{Timelike, Datelike};

/// Schedule settings for automated report generation
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ScheduleSettings {
    pub enabled: bool,
    pub time: String, // HH:mm format, e.g., "18:00"
    pub days: Vec<u8>, // 0=Sunday, 1=Monday, ..., 6=Saturday
}

impl Default for ScheduleSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            time: "18:00".to_string(),
            days: vec![1, 2, 3, 4, 5], // Mon-Fri
        }
    }
}

/// Application state to track quitting status and schedule settings
struct AppState {
    is_quitting: AtomicBool,
    schedule_settings: Mutex<ScheduleSettings>,
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

    #[tauri::command]
    fn update_schedule_settings(
        state: tauri::State<'_, AppState>,
        settings: ScheduleSettings,
    ) -> Result<(), String> {
        log::info!("[Scheduler] Updating schedule settings: enabled={}, time={}, days={:?}", 
            settings.enabled, settings.time, settings.days);
        
        match state.schedule_settings.lock() {
            Ok(mut current) => {
                *current = settings;
                Ok(())
            }
            Err(e) => Err(format!("Failed to update schedule settings: {}", e)),
        }
    }

    fn start_background_scheduler(app_handle: tauri::AppHandle) {
        std::thread::spawn(move || {
            log::info!("[Scheduler] Background scheduler started");
            
            loop {
                // Sleep for 60 seconds
                std::thread::sleep(Duration::from_secs(60));
                
                // Get current time
                let now = chrono::Local::now();
                let current_hour = now.hour();
                let current_minute = now.minute();
                let current_day = now.weekday().num_days_from_sunday() as u8; // 0=Sunday
                let today_str = now.format("%Y-%m-%d").to_string();
                
                // Check schedule settings
                let should_trigger = {
                    let state = app_handle.state::<AppState>();
                    match state.schedule_settings.lock() {
                        Ok(settings) => {
                            if !settings.enabled {
                                false
                            } else if !settings.days.contains(&current_day) {
                                false
                            } else {
                                // Parse scheduled time
                                let parts: Vec<&str> = settings.time.split(':').collect();
                                if parts.len() == 2 {
                                    if let (Ok(scheduled_hour), Ok(scheduled_minute)) = 
                                        (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                                        current_hour == scheduled_hour && current_minute == scheduled_minute
                                    } else {
                                        false
                                    }
                                } else {
                                    false
                                }
                            }
                        }
                        Err(_) => false,
                    }
                };
                
                if should_trigger {
                    log::info!("[Scheduler] ⏰ Triggering scheduled report at {}:{:02}", 
                        current_hour, current_minute);
                    
                    // Emit event to frontend
                    #[derive(Clone, serde::Serialize)]
                    struct ScheduleTriggerPayload {
                        timestamp: i64,
                        date: String,
                        time: String,
                    }
                    
                    let payload = ScheduleTriggerPayload {
                        timestamp: now.timestamp_millis(),
                        date: today_str,
                        time: format!("{}:{:02}", current_hour, current_minute),
                    };
                    
                    if let Err(e) = app_handle.emit("schedule-trigger", payload) {
                        log::error!("[Scheduler] Failed to emit schedule-trigger event: {}", e);
                    }
                }
            }
        });
    }

    tauri::Builder::default()
        .manage(AppState {
            is_quitting: AtomicBool::new(false),
            schedule_settings: Mutex::new(ScheduleSettings::default()),
        })
        .invoke_handler(tauri::generate_handler![update_schedule_settings])
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: None,
                    }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(3))
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:tada.db", migrations)
                .build(),
        )
        .setup(|app| {
            // Create a tray menu
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Tada", true, None::<&str>)?;
            let logs_i = MenuItem::with_id(app, "open_logs", "Open Logs", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &logs_i, &quit_i])?;

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
                    "open_logs" => {
                        let app_handle = app.app_handle();
                        if let Ok(path) = app_handle.path().app_log_dir() {
                            if let Some(path_str) = path.to_str() {
                                #[cfg(target_os = "macos")]
                                let _ = std::process::Command::new("open").arg(path_str).spawn();
                                #[cfg(target_os = "windows")]
                                let _ = std::process::Command::new("explorer").arg(path_str).spawn();
                                #[cfg(target_os = "linux")]
                                let _ = std::process::Command::new("xdg-open").arg(path_str).spawn();
                            }
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

            start_background_scheduler(app.handle().clone());

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