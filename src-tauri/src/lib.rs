mod commands;

use commands::{list_inventories, list_playbooks, run_playbook, kill_playbook, get_settings, save_settings, read_file, check_for_updates, open_in_editor, git_push, check_git_ahead, git_show_status};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            list_inventories,
            list_playbooks,
            run_playbook,
            kill_playbook,
            get_settings,
            save_settings,
            read_file,
            check_for_updates,
            open_in_editor,
            git_push,
            check_git_ahead,
            git_show_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}