# Ping & Credentials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an SSH password field to Settings and a Ping button that tests host connectivity via `ansible all -m ping`, with credentials passed automatically to both ping and playbook runs.

**Architecture:** `ssh_password` is added to `AppConfig` (Rust struct + TypeScript interface), persisted in the existing `config.json` store. Both `run_playbook` and a new `ping_hosts` Rust command inject credentials as `--extra-vars` when the field is non-empty. The Ping button in the Terminal toolbar mirrors the Run button pattern: store method → Tauri invoke → `ansible-output` event stream → `ansible-complete`.

**Tech Stack:** Rust/Tauri 2, React 18/TypeScript, Zustand, tauri-plugin-store

---

### Task 1: Add `ssh_password` to Rust `AppConfig`

**Files:**
- Modify: `src-tauri/src/commands/mod.rs:27-84`

- [ ] **Step 1: Add field to struct and Default**

In `commands/mod.rs`, update `AppConfig` and its `Default` impl:

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub ansible_dir: String,
    pub inventory_dir: String,
    pub playbook_dir: String,
    pub git_enabled: bool,
    pub git_pull_before_run: bool,
    pub editor_cmd: String,
    pub ssh_password: String,      // ← add this
}

impl Default for AppConfig {
    fn default() -> Self {
        let documents = dirs::document_dir()
            .or_else(dirs::home_dir)
            .unwrap_or_else(|| PathBuf::from("."));
        let ansible_dir = documents.join("ansible");
        Self {
            ansible_dir: ansible_dir.to_string_lossy().to_string(),
            inventory_dir: ansible_dir.join("inventory").to_string_lossy().to_string(),
            playbook_dir: ansible_dir.join("playbook").to_string_lossy().to_string(),
            git_enabled: false,
            git_pull_before_run: false,
            editor_cmd: String::new(),
            ssh_password: String::new(),    // ← add this
        }
    }
}
```

- [ ] **Step 2: Read `ssh_password` in `get_config`**

Replace the existing `get_config` function (lines 53–72) with:

```rust
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
                git_enabled: store.get("git_enabled").and_then(|v| v.as_bool()).unwrap_or(false),
                git_pull_before_run: store.get("git_pull_before_run").and_then(|v| v.as_bool()).unwrap_or(false),
                editor_cmd: store.get("editor_cmd").and_then(|v| v.as_str().map(|s| s.to_string())).unwrap_or_default(),
                ssh_password: store.get("ssh_password").and_then(|v| v.as_str().map(|s| s.to_string())).unwrap_or_default(),
            };
        }
    }
    default
}
```

- [ ] **Step 3: Write `ssh_password` in `save_config`**

Add one line to `save_config` after the `editor_cmd` line (line 81):

```rust
store.set("ssh_password", serde_json::Value::String(config.ssh_password.clone()));
```

- [ ] **Step 4: Verify it compiles**

```bash
cd C:\apps\ursula\src-tauri && cargo check
```

Expected: no errors (warnings about unused are fine).

- [ ] **Step 5: Commit**

```bash
cd C:\apps\ursula
git add src-tauri/src/commands/mod.rs
git commit -m "feat: add ssh_password field to AppConfig"
```

---

### Task 2: Inject credentials into `run_playbook`

**Files:**
- Modify: `src-tauri/src/commands/mod.rs` — `run_playbook` function (~line 426)

- [ ] **Step 1: Add credential extra-vars after building the base command**

Find the block that builds `cmd` in `run_playbook` (around line 426). After `cmd.env("ANSIBLE_FORCE_COLOR", "1");` and before `cmd.stdout(...)`, add:

```rust
if !config.ssh_password.is_empty() {
    cmd.arg("--extra-vars")
       .arg(format!("ansible_ssh_pass={} ansible_become_pass={}", config.ssh_password, config.ssh_password));
}
```

The full block should look like:

```rust
let mut cmd = Command::new("ansible-playbook");
cmd.arg("-i").arg(&inventory).arg(&playbook);
if let Some(lim) = &limit {
    if !lim.is_empty() {
        cmd.arg("--limit").arg(lim);
    }
}
if !config.ssh_password.is_empty() {
    cmd.arg("--extra-vars")
       .arg(format!("ansible_ssh_pass={} ansible_become_pass={}", config.ssh_password, config.ssh_password));
}
cmd.current_dir(&ansible_dir);
cmd.env("ANSIBLE_FORCE_COLOR", "1");
cmd.stdout(std::process::Stdio::piped());
cmd.stderr(std::process::Stdio::piped());
```

- [ ] **Step 2: Verify it compiles**

```bash
cd C:\apps\ursula\src-tauri && cargo check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd C:\apps\ursula
git add src-tauri/src/commands/mod.rs
git commit -m "feat: pass ssh credentials as extra-vars in run_playbook"
```

---

### Task 3: Add `ping_hosts` Rust command

**Files:**
- Modify: `src-tauri/src/commands/mod.rs` — add new command after `kill_playbook`

- [ ] **Step 1: Add the command**

Insert the following after the closing `}` of `kill_playbook` (around line 510):

```rust
#[tauri::command]
pub async fn ping_hosts(app: AppHandle, inventory: String) -> Result<(), String> {
    let config = get_config(&app);
    let ansible_dir = PathBuf::from(&config.ansible_dir);

    let mut cmd = Command::new("ansible");
    cmd.arg("all")
       .arg("-i").arg(&inventory)
       .arg("-m").arg("ping");

    if !config.ssh_password.is_empty() {
        cmd.arg("--extra-vars")
           .arg(format!("ansible_ssh_pass={} ansible_become_pass={}", config.ssh_password, config.ssh_password));
    }

    cmd.current_dir(&ansible_dir);
    cmd.env("ANSIBLE_FORCE_COLOR", "1");
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
            let (stream, parts) = categorize_ansible_line(&line);
            let _ = app_stdout.emit("ansible-output", OutputLine { line, stream, parts });
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

    let _ = app.emit("ansible-output", OutputLine {
        line: format!("\nProcess exited with code {}", status.code().unwrap_or(-1)),
        stream: if status.success() { "success" } else { "error" }.to_string(),
        parts: None,
    });
    let _ = app.emit("ansible-complete", status.success());

    Ok(())
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd C:\apps\ursula\src-tauri && cargo check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd C:\apps\ursula
git add src-tauri/src/commands/mod.rs
git commit -m "feat: add ping_hosts Tauri command"
```

---

### Task 4: Register `ping_hosts` in lib.rs

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add to the use statement and handler list**

Replace the existing content of `lib.rs` with:

```rust
mod commands;

use commands::{list_inventories, list_playbooks, run_playbook, kill_playbook, ping_hosts, get_settings, save_settings, read_file, check_for_updates, open_in_editor, git_push, check_git_state, git_show_status, git_commit};

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
            ping_hosts,
            get_settings,
            save_settings,
            read_file,
            check_for_updates,
            open_in_editor,
            git_push,
            check_git_state,
            git_show_status,
            git_commit,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd C:\apps\ursula\src-tauri && cargo check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd C:\apps\ursula
git add src-tauri/src/lib.rs
git commit -m "feat: register ping_hosts command"
```

---

### Task 5: Update TypeScript AppConfig and store

**Files:**
- Modify: `src/store/appStore.ts`

- [ ] **Step 1: Add `ssh_password` to the `AppConfig` interface**

At the top of `appStore.ts`, update the `AppConfig` interface (line 6):

```typescript
interface AppConfig {
  ansible_dir: string;
  inventory_dir: string;
  playbook_dir: string;
  git_enabled: boolean;
  git_pull_before_run: boolean;
  editor_cmd: string;
  ssh_password: string;    // ← add this
}
```

- [ ] **Step 2: Add `pingHosts` to `AppState` interface**

In the `AppState` interface (around line 238), add:

```typescript
pingHosts: () => Promise<void>;
```

- [ ] **Step 3: Add `pingHosts` implementation to the store**

In the `create<AppState>` body, add `pingHosts` after the `kill` method:

```typescript
pingHosts: async () => {
  const { selectedInventory, clearOutput } = get();
  if (!selectedInventory) return;

  set({ filePreview: null });
  clearOutput();
  set({ status: "running" });

  let unlisten: (() => void) | undefined;
  let unlistenComplete: (() => void) | undefined;
  try {
    unlisten = await listen<OutputLine>("ansible-output", (event) => {
      set((state) => ({ output: [...state.output, event.payload] }));
    });
    unlistenComplete = await listen<boolean>("ansible-complete", (event) => {
      set({ status: event.payload ? "success" : "failed" });
    });
    await invoke("ping_hosts", { inventory: selectedInventory.path });
  } catch (err) {
    set({
      output: [{ line: String(err), stream: "stderr" }],
      status: "failed",
    });
  } finally {
    unlisten?.();
    unlistenComplete?.();
  }
},
```

- [ ] **Step 4: Commit**

```bash
cd C:\apps\ursula
git add src/store/appStore.ts
git commit -m "feat: add pingHosts store method and ssh_password to AppConfig"
```

---

### Task 6: Settings UI — SSH Password field

**Files:**
- Modify: `src/App.tsx` — `SettingsPanel` component

- [ ] **Step 1: Add `sshPassword` local state to `SettingsPanel`**

In the `SettingsPanel` function, after the `editorCmd` state line (~line 162), add:

```typescript
const [sshPassword, setSshPassword] = useState(config?.ssh_password || "");
const [showPassword, setShowPassword] = useState(false);
```

- [ ] **Step 2: Sync `sshPassword` from config in the `useEffect`**

In the `useEffect` that syncs config (~line 164), add inside the `if (config)` block:

```typescript
setSshPassword(config.ssh_password);
```

- [ ] **Step 3: Update `SettingsPanel` `onSave` prop type**

In the `SettingsPanel` function signature (~line 139 of `App.tsx`), the `onSave` prop has an inline type. Add `ssh_password: string` to it:

```typescript
onSave: (config: {
  ansible_dir: string;
  inventory_dir: string;
  playbook_dir: string;
  git_enabled: boolean;
  git_pull_before_run: boolean;
  editor_cmd: string;
  ssh_password: string;   // ← add this
}) => void;
```

- [ ] **Step 4: Include `ssh_password` in `handleSave`**

In `handleSave` (~line 175), add `ssh_password` to the object passed to `onSave`:

```typescript
const handleSave = () => {
  onSave({
    ansible_dir: ansibleDir,
    inventory_dir: inventoryDir,
    playbook_dir: playbookDir,
    git_enabled: gitEnabled,
    git_pull_before_run: gitPullBeforeRun,
    editor_cmd: editorCmd,
    ssh_password: sshPassword,
  });
};
```

- [ ] **Step 5: Add the password field in the General tab JSX**

In the General tab section (after the Editor Command field, before the closing `</div>`), add:

```tsx
<div className="settings-field">
  <label>SSH Password</label>
  <div style={{ display: "flex", gap: "6px" }}>
    <input
      type={showPassword ? "text" : "password"}
      value={sshPassword}
      onChange={(e) => setSshPassword(e.target.value)}
      placeholder="Leave blank to use SSH key auth"
      style={{ flex: 1 }}
    />
    <button
      type="button"
      className="copy-btn"
      onClick={() => setShowPassword((v) => !v)}
      title={showPassword ? "Hide password" : "Show password"}
    >
      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  </div>
  <span className="settings-field-hint">Stored in plain text. Leave blank if using SSH key auth.</span>
</div>
```

- [ ] **Step 6: Add `EyeIcon` and `EyeOffIcon` SVG components**

Add these two icon components near the other icon components at the bottom of `App.tsx`:

```tsx
function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
```

- [ ] **Step 7: Add `.settings-field-hint` CSS to `styles.css`**

Add after the existing `.settings-field label` rule:

```css
.settings-field-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 3px;
  display: block;
}
```

- [ ] **Step 8: Commit**

```bash
cd C:\apps\ursula
git add src/App.tsx src/styles.css
git commit -m "feat: add SSH password field to Settings General tab"
```

---

### Task 7: Add Ping button to Terminal toolbar

**Files:**
- Modify: `src/App.tsx` — `Terminal` component and `App` root component

- [ ] **Step 1: Add `onPing` prop to the `Terminal` component signature**

In the `Terminal` function signature (~line 433), add `onPing` to the props:

```typescript
function Terminal({ selectedInventory, selectedPlaybook, limit, status, output, filePreview, canExecute, gitEnabled, gitAhead, gitDirty, onLimitChange, onExecute, onKill, onClosePreview, onGitPush, onGitStatus, onGitCommit, onPing }: {
  // ... existing props ...
  onPing: () => void;
}) {
```

- [ ] **Step 2: Add the Ping button constant**

After the `runOrStop` constant (~line 498), add:

```typescript
const canPing = !!(selectedInventory && status !== "running");

const pingBtn = canPing
  ? <button className="execute-btn execute-btn--ping" onClick={onPing}><PingIcon />Ping</button>
  : null;
```

- [ ] **Step 3: Add `pingBtn` to all three Terminal render branches**

In each of the three return blocks (preview, output, idle), add `{pingBtn}` inside `terminal-actions` before `{runOrStop}`:

```tsx
<div className="terminal-actions">
  {gitBtn}
  {pingBtn}
  {runOrStop}
</div>
```

Apply this to all three `terminal-actions` divs in the component.

- [ ] **Step 4: Add `PingIcon` SVG component**

```tsx
function PingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
      <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
      <circle cx="12" cy="20" r="1" fill="currentColor"/>
    </svg>
  );
}
```

- [ ] **Step 5: Add `.execute-btn--ping` CSS to `styles.css`**

Add alongside the existing `.execute-btn--commit` and `.execute-btn--push` rules:

```css
.execute-btn--ping {
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
.execute-btn--ping:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
```

- [ ] **Step 6: Wire `onPing` in `App` root component**

In `App.tsx`, destructure `pingHosts` from `useAppStore` (add to the existing destructure at line 7):

```typescript
const { ..., pingHosts } = useAppStore();
```

Pass it to `<Terminal>`:

```tsx
<Terminal
  {/* existing props */}
  onPing={pingHosts}
/>
```

- [ ] **Step 7: Final build check**

```bash
cd C:\apps\ursula && npm run build
```

Expected: TypeScript compiles with no errors.

- [ ] **Step 8: Commit**

```bash
cd C:\apps\ursula
git add src/App.tsx src/styles.css
git commit -m "feat: add Ping button to Terminal toolbar"
```

---

### Task 8: Manual verification

- [ ] Start the app: `npm run tauri dev` from `C:\apps\ursula`
- [ ] Open Settings → General — confirm SSH Password field appears with show/hide toggle and hint text
- [ ] Enter your SSH password (`dro`'s password for `192.168.0.100`), save
- [ ] Select `hosts.yml` in the inventory sidebar — confirm Ping button appears in toolbar
- [ ] Click Ping — confirm terminal streams `ansible all -m ping` output, `ok: [ubuntu_server]` shows green
- [ ] Click Run with a playbook selected — confirm it still works and credentials are passed
- [ ] Clear the SSH password, save, click Ping again — confirm it still attempts (key auth path)
