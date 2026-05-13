use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};
use tauri::{AppHandle, Emitter};
use tauri_plugin_store::StoreExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct Inventory {
    pub id: String,
    pub name: String,
    pub path: String,
    pub is_folder: bool,
    pub children: Vec<Inventory>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Playbook {
    pub id: String,
    pub name: String,
    pub path: String,
    pub is_folder: bool,
    pub children: Vec<Playbook>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub ansible_dir: String,
    pub inventory_dir: String,
    pub playbook_dir: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        let documents = dirs::document_dir()
            .unwrap_or_else(|| PathBuf::from("/home/cashby/Documents"));
        let ansible_dir = documents.join("ansible");
        Self {
            ansible_dir: ansible_dir.to_string_lossy().to_string(),
            inventory_dir: ansible_dir.join("inventory").to_string_lossy().to_string(),
            playbook_dir: ansible_dir.join("playbook").to_string_lossy().to_string(),
        }
    }
}

fn get_config(app: &AppHandle) -> AppConfig {
    let default = AppConfig::default();
    if let Ok(store) = app.store("config.json") {
        if let (Some(ansible_dir), Some(inventory_dir), Some(playbook_dir)) = (
            store.get("ansible_dir").and_then(|v| v.as_str().map(|s| s.to_string())),
            store.get("inventory_dir").and_then(|v| v.as_str().map(|s| s.to_string())),
            store.get("playbook_dir").and_then(|v| v.as_str().map(|s| s.to_string())),
        ) {
            return AppConfig {
                ansible_dir,
                inventory_dir,
                playbook_dir,
            };
        }
    }
    default
}

fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    store.set("ansible_dir", serde_json::Value::String(config.ansible_dir.clone()));
    store.set("inventory_dir", serde_json::Value::String(config.inventory_dir.clone()));
    store.set("playbook_dir", serde_json::Value::String(config.playbook_dir.clone()));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<AppConfig, String> {
    Ok(get_config(&app))
}

#[tauri::command]
pub async fn save_settings(app: AppHandle, config: AppConfig) -> Result<(), String> {
    save_config(&app, &config)
}

fn scan_dir(path: &PathBuf) -> Vec<Inventory> {
    let mut items = Vec::new();

    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            let name = entry_path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            if entry_path.is_dir() {
                let children = scan_dir(&entry_path);
                items.push(Inventory {
                    id: name.clone(),
                    name,
                    path: entry_path.to_string_lossy().to_string(),
                    is_folder: true,
                    children,
                });
            } else if name.ends_with(".yml") || name.ends_with(".yaml") {
                let id = name.trim_end_matches(".yml").trim_end_matches(".yaml").to_string();
                items.push(Inventory {
                    id: id.clone(),
                    name,
                    path: entry_path.to_string_lossy().to_string(),
                    is_folder: false,
                    children: vec![],
                });
            }
        }
    }

    items.sort_by(|a, b| {
        if a.is_folder != b.is_folder {
            if a.is_folder { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Less }
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });
    items
}

#[tauri::command]
pub async fn list_inventories(app: AppHandle) -> Result<Vec<Inventory>, String> {
    let config = get_config(&app);
    let target_dir = PathBuf::from(&config.inventory_dir);
    Ok(scan_dir(&target_dir))
}

#[tauri::command]
pub async fn list_playbooks(app: AppHandle) -> Result<Vec<Playbook>, String> {
    let config = get_config(&app);
    let target_dir = PathBuf::from(&config.playbook_dir);
    let items = scan_dir(&target_dir);
    Ok(items.into_iter().map(|inv| Playbook {
        id: inv.id,
        name: inv.name,
        path: inv.path,
        is_folder: inv.is_folder,
        children: inv.children.into_iter().map(|c| Playbook {
            id: c.id,
            name: c.name,
            path: c.path,
            is_folder: c.is_folder,
            children: vec![],
        }).collect(),
    }).collect())
}

#[tauri::command]
#[allow(dead_code)]
pub async fn list_groups(app: AppHandle, inventory: String) -> Result<Vec<String>, String> {
    let config = get_config(&app);
    let ansible_dir = PathBuf::from(&config.ansible_dir);

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
                if !k.starts_with('_') && k != "hostvars" && k != "profile" {
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

lazy_static::lazy_static! {
    static ref RUNNING_CHILD: std::sync::Mutex<Option<u32>> = std::sync::Mutex::new(None);
}

fn set_running_pid(pid: Option<u32>) {
    if let Ok(mut lock) = RUNNING_CHILD.lock() {
        *lock = pid;
    }
}

fn get_running_pid() -> Option<u32> {
    RUNNING_CHILD.lock().ok().and_then(|lock| *lock)
}

fn clear_running_pid() {
    if let Ok(mut lock) = RUNNING_CHILD.lock() {
        *lock = None;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputLine {
    pub line: String,
    pub stream: String,
    pub parts: Option<Vec<LinePart>>,
}

#[tauri::command]
pub async fn list_children(app: AppHandle, inventory: String, group: String) -> Result<Vec<String>, String> {
    let config = get_config(&app);
    let ansible_dir = PathBuf::from(&config.ansible_dir);

    let mut cmd = Command::new("ansible-inventory");
    cmd.arg("-i").arg(&inventory).arg("--list");
    cmd.current_dir(&ansible_dir);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let output = cmd.output().await.map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    let mut result: Vec<String> = Vec::new();

    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
        if let Some(group_data) = json.get(&group) {
            if let Some(obj) = group_data.as_object() {
                if let Some(hosts_obj) = obj.get("hosts") {
                    if let Some(hosts_arr) = hosts_obj.as_array() {
                        for h in hosts_arr {
                            if let Some(name) = h.as_str() {
                                result.push(name.to_string());
                            }
                        }
                    }
                }
                if let Some(children_obj) = obj.get("children") {
                    if let Some(child_arr) = children_obj.as_array() {
                        for g in child_arr {
                            if let Some(name) = g.as_str() {
                                result.push(name.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    result.sort();
    Ok(result)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinePart {
    pub text: String,
    pub stream: String,
}

fn extract_num_after(s: &str, key: &str) -> i32 {
    if let Some(pos) = s.find(key) {
        let after = &s[pos + key.len()..];
        let num_str: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(n) = num_str.parse() {
            return n;
        }
    }
    0
}

fn categorize_ansible_line(line: &str) -> (String, Option<Vec<LinePart>>) {
    let trimmed = line.trim();

    if trimmed.is_empty() {
        return ("muted".to_string(), None);
    }

    if trimmed.starts_with("PLAY [") || trimmed.starts_with("TASK [") || trimmed.starts_with("BECOME") || trimmed.starts_with("META:") || trimmed.starts_with("武士") {
        return ("stdout".to_string(), None);
    }

    if trimmed.starts_with("PLAY RECAP") {
        return ("stdout".to_string(), None);
    }

    if trimmed.contains("fatal:") || trimmed.contains("ERROR:") || trimmed.starts_with("FAILED") {
        return ("error".to_string(), None);
    }

    if trimmed.contains("skipping") && trimmed.contains("0") {
        return ("muted".to_string(), None);
    }

    if trimmed.contains("ok=") && trimmed.contains("changed=") && trimmed.contains("unreachable=") && trimmed.contains("failed=") {
        let failed = extract_num_after(trimmed, "failed=");
        let unreachable = extract_num_after(trimmed, "unreachable=");
        let changed = extract_num_after(trimmed, "changed=");

        let parts = parse_host_summary_parts(trimmed, failed, unreachable, changed);
        return ("mixed".to_string(), Some(parts));
    }

    if trimmed.starts_with("ok") && trimmed.contains("[") {
        return ("success".to_string(), None);
    }

    if trimmed.starts_with("changed") && trimmed.contains("[") {
        return ("warning".to_string(), None);
    }

    if trimmed.contains("skipping") {
        return ("muted".to_string(), None);
    }

    ("stdout".to_string(), None)
}

fn parse_host_summary_parts(line: &str, _failed: i32, _unreachable: i32, _changed: i32) -> Vec<LinePart> {
    let mut parts = Vec::new();
    let mut remaining = line;

    while !remaining.is_empty() {
        let (key, value, rest): (&str, &str, &str) = if let Some(pos) = remaining.find('=') {
            let before_eq = &remaining[..pos];
            let after_eq = &remaining[pos + 1..];
            let (val_str, rest_str) = if let Some(space_pos) = after_eq.find(' ') {
                (&after_eq[..space_pos], &after_eq[space_pos + 1..])
            } else {
                (after_eq, "")
            };

            (before_eq, val_str, rest_str)
        } else {
            break;
        };

        let val_num: i32 = value.chars().take_while(|c| c.is_ascii_digit()).collect::<String>().parse().unwrap_or(0);

        let stream = if key == "ok" {
            "success".to_string()
        } else if key == "failed" || key == "unreachable" {
            if val_num > 0 { "error".to_string() } else { "success".to_string() }
        } else if key == "changed" {
            if val_num > 0 { "warning".to_string() } else { "success".to_string() }
        } else {
            "stdout".to_string()
        };

        parts.push(LinePart { text: format!("{}={}", key, value), stream });

        remaining = rest;
    }

    parts
}

#[tauri::command]
pub async fn run_playbook(app: AppHandle, inventory: String, playbook: String, limit: Option<String>) -> Result<(), String> {
    let config = get_config(&app);
    let ansible_dir = PathBuf::from(&config.ansible_dir);

    if let Some(pid) = get_running_pid() {
        if std::process::Command::new("kill").arg("-15").arg(pid.to_string()).spawn().is_ok() {
            let _ = std::thread::sleep(std::time::Duration::from_millis(500));
        }
    }

    let mut cmd = Command::new("ansible-playbook");
    cmd.arg("-i").arg(&inventory).arg(&playbook);
    if let Some(lim) = &limit {
        if !lim.is_empty() {
            cmd.arg("--limit").arg(lim);
        }
    }
    cmd.current_dir(&ansible_dir);
    cmd.env("ANSIBLE_FORCE_COLOR", "1");

    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    if let Some(pid) = child.id() {
        eprintln!("Started ansible-playbook with PID: {}", pid);
        set_running_pid(Some(pid));
    }

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let app_stdout = app.clone();
    let app_stderr = app.clone();

    let stdout_handle = tokio::spawn(async move {
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            let (stream, parts) = categorize_ansible_line(&line);
            let _ = app_stdout.emit("ansible-output", OutputLine {
                line,
                stream,
                parts,
            });
        }
    });

    let stderr_handle = tokio::spawn(async move {
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            let _ = app_stderr.emit("ansible-output", OutputLine {
                line,
                stream: "stderr".to_string(),
                parts: None,
            });
        }
    });

    let _ = tokio::join!(stdout_handle, stderr_handle);

    let status = child.wait().await.map_err(|e| e.to_string())?;
    clear_running_pid();

    let _ = app.emit("ansible-output", OutputLine {
        line: format!("\nProcess exited with code {}", status.code().unwrap_or(-1)),
        stream: if status.success() { "success" } else { "error" }.to_string(),
        parts: None,
    });

    let _ = app.emit("ansible-complete", status.success());

    Ok(())
}

#[tauri::command]
pub async fn kill_playbook() -> Result<(), String> {
    if let Some(pid) = get_running_pid() {
        eprintln!("Killing PID: {}", pid);
        let _ = std::process::Command::new("kill")
            .arg("-15")
            .arg(pid.to_string())
            .output();
        clear_running_pid();
    } else {
        eprintln!("No PID to kill");
    }
    Ok(())
}