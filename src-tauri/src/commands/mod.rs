use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct Inventory {
    pub id: String,
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Playbook {
    pub id: String,
    pub name: String,
    pub path: String,
}

fn get_ansible_dir() -> PathBuf {
    dirs::document_dir()
        .unwrap_or_else(|| PathBuf::from("/home/cashby/Documents"))
        .join("ansible")
}

fn get_files(dir: &str, ext: &str) -> Vec<Inventory> {
    let ansible_dir = get_ansible_dir();
    let target_dir = ansible_dir.join(dir);
    
    let mut items = Vec::new();
    
    if let Ok(entries) = std::fs::read_dir(&target_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name() {
                    let name_str = name.to_string_lossy();
                    if name_str.ends_with(ext) {
                        let id = name_str.trim_end_matches(ext).to_string();
                        items.push(Inventory {
                            id: id.clone(),
                            name: id,
                            path: path.to_string_lossy().to_string(),
                        });
                    }
                }
            }
        }
    }
    
    items.sort_by(|a, b| a.name.cmp(&b.name));
    items
}

#[tauri::command]
pub async fn list_inventories() -> Result<Vec<Inventory>, String> {
    Ok(get_files("inventory", ".yml"))
}

#[tauri::command]
pub async fn list_playbooks() -> Result<Vec<Playbook>, String> {
    Ok(get_files("playbook", ".yml").into_iter().map(|inv| Playbook {
        id: inv.id,
        name: inv.name,
        path: inv.path,
    }).collect())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

#[tauri::command]
pub async fn run_playbook(inventory: String, playbook: String) -> Result<ExecutionResult, String> {
    let ansible_dir = get_ansible_dir();
    
    let mut cmd = Command::new("ansible-playbook");
    cmd.arg("-i").arg(&inventory).arg(&playbook);
    cmd.current_dir(&ansible_dir);
    
    let output = cmd.output().await.map_err(|e| e.to_string())?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let success = output.status.success();
    
    Ok(ExecutionResult {
        success,
        stdout,
        stderr,
    })
}