mod commands;

use commands::{list_inventories, list_playbooks, list_all_children, list_children, run_playbook};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            list_inventories,
            list_playbooks,
            list_all_children,
            list_children,
            run_playbook,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}