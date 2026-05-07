use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};
use tauri::Emitter;

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

#[tauri::command]
pub async fn list_groups(inventory: String) -> Result<Vec<String>, String> {
    let ansible_dir = get_ansible_dir();
    
    let mut cmd = Command::new("ansible-inventory");
    cmd.arg("-i").arg(&inventory).arg("--list");
    cmd.current_dir(&ansible_dir);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    
    let output = cmd.output().await.map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    
    let groups = if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
        let mut result = Vec::new();
        if let Some(meta) = json.get("_meta") {
            if let Some(hosts) = meta.as_object() {
                for h in hosts.keys() {
                    result.push(h.clone());
                }
            }
        }
        if let Some(obj) = json.as_object() {
            for (k, _) in obj {
                if !k.starts_with('_') {
                    result.push(k.clone());
                }
            }
        }
        result.sort();
        result.dedup();
        result
    } else {
        Vec::new()
    };
    
    Ok(groups)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputLine {
    pub line: String,
    pub stream: String,
}

#[tauri::command]
pub async fn run_playbook(app: tauri::AppHandle, inventory: String, playbook: String, limit: Option<String>) -> Result<(), String> {
    let ansible_dir = get_ansible_dir();
    
    let mut cmd = Command::new("ansible-playbook");
    cmd.arg("-i").arg(&inventory).arg(&playbook);
    if let Some(lim) = &limit {
        if !lim.is_empty() {
            cmd.arg("--limit").arg(lim);
        }
    }
    cmd.current_dir(&ansible_dir);
    
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    
    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    
    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();
    
    let app_stdout = app.clone();
    let app_stderr = app.clone();
    
    let stdout_handle = tokio::spawn(async move {
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            let _ = app_stdout.emit("ansible-output", OutputLine {
                line,
                stream: "stdout".to_string(),
            });
        }
    });
    
    let stderr_handle = tokio::spawn(async move {
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            let _ = app_stderr.emit("ansible-output", OutputLine {
                line,
                stream: "stderr".to_string(),
            });
        }
    });
    
    let _ = tokio::join!(stdout_handle, stderr_handle);
    
    let status = child.wait().await.map_err(|e| e.to_string())?;
    
    let _ = app.emit("ansible-output", OutputLine {
        line: format!("\nProcess exited with code {}", status.code().unwrap_or(-1)),
        stream: if status.success() { "success" } else { "error" }.to_string(),
    });
    
    let _ = app.emit("ansible-complete", status.success());
    
    Ok(())
}