# Ursula

> Ansible lazyness, enhanced.

A lightweight Tauri 2 desktop application that provides a clean GUI for running Ansible playbooks — browse your inventory and playbook directories, execute runs with real-time streaming output, and manage Git state, all without leaving the app.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 18 + TypeScript 5 |
| Build Tool | Vite 7 (dev server on port 5174) |
| State Management | Zustand 4 |
| Desktop Shell | Tauri 2 (Rust) |
| Async Runtime | Tokio 1 |
| HTTP (update check) | reqwest 0.12 |
| Icons | lucide-react |
| Styling | CSS custom properties (single stylesheet) |
| Persistence | Tauri Plugin Store (JSON config file) |

---

## Installation

**Prerequisites:**
- [Node.js](https://nodejs.org/) 18+
- [Rust + Cargo](https://rustup.rs/) (stable toolchain)
- [Tauri CLI v2](https://tauri.app/start/prerequisites/)
- [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/) installed and on `$PATH`

```bash
# Clone the repo
git clone https://github.com/GnomishGames/ursula
cd ursula

# Install Node dependencies
npm install

# Run in development mode (Rust + React hot reload)
npm run tauri dev

# Build a release installer
npm run tauri build
```

Installers land in `src-tauri/target/release/bundle/` for your platform (Windows NSIS/MSI, macOS DMG, Linux .deb/AppImage).

---

## Usage

### First-time Configuration

Open **Settings** (gear icon in the status bar) and configure:

| Setting | Description |
|---------|-------------|
| Ansible Directory | Base directory for your Ansible project |
| Inventory Directory | Where Ursula scans for `.yml`/`.yaml` inventory files |
| Playbook Directory | Where Ursula scans for `.yml`/`.yaml` playbook files |
| Editor Command | External editor to open files (`code`, `vim`, etc.) |
| Git Integration | Enable Git commands (commit/push/pull) |
| Pull before run | Auto-run `git pull` before each playbook execution |

Default paths are `~/Documents/ansible/inventory/` and `~/Documents/ansible/playbook/`.

### Running a Playbook

1. Select an **inventory file** from the left sidebar.
2. Select a **playbook file** from the right sidebar.
3. Optionally enter a `--limit` value to restrict the run to specific hosts/groups.
4. Click **Run** — output streams in real-time to the terminal panel.
5. Click **Stop** to kill a running process.

The toolbar shows the exact `ansible-playbook` command being built as you make selections. Use the copy button to grab it for the terminal.

### File Preview

Double-click any file in either sidebar to preview its contents with line numbers in the main panel.

### Git Workflow

With Git enabled, toolbar buttons appear based on repo state:

- **Commit** — stage all changes (`git add -A`) and commit with a message.
- **Push (N)** — push commits ahead of upstream.
- **Status** — run `git status` and stream output to the terminal panel.

If **Pull before run** is enabled, Ursula runs `git pull` automatically before each playbook execution.

---

## UI Overview

```
┌─────────────────────────────────────────────────────────┐
│  [Inventory Sidebar] │ [Terminal/Preview Panel] │ [Playbook Sidebar] │
│                      │                          │                    │
│  inventory/          │  PLAY [web_servers] ***  │  site.yml          │
│  ├─ production.yml   │  TASK [Install nginx]    │  deploy/           │
│  └─ staging.yml      │    ok: [10.0.0.1]        │  ├─ web.yml        │
│                      │    ok: [10.0.0.2]        │  └─ db.yml         │
│                      │                          │                    │
├──────────────────────┴──────────────────────────┴────────────────────┤
│  Status Bar: ansible_dir path  |  ⚙ Settings                        │
└─────────────────────────────────────────────────────────────────────┘
```

The two sidebars are individually resizable. Both support search filtering and hierarchical folder expansion (two levels deep).

---

## Themes

Ursula ships with 9 themes, configurable in Settings → Appearance:

**Dark:** Midnight (default), Dracula, Nord, Gruvbox, Catppuccin
**Light:** GitHub Light, Solarized Light, One Light

---

## Example Playbooks for Testing & Validation

The following two playbooks cover the most useful scenarios for testing Ursula's UI behavior — output streaming, color-coded status lines, and success/failure indication.

### 1. `smoke-test.yml` — Basic connectivity and facts

Validates that Ursula correctly streams PLAY/TASK headings, `ok:` lines, and the final PLAY RECAP with zero failures. A good "green path" test.

```yaml
# playbook/smoke-test.yml
---
- name: Smoke test — connectivity and facts
  hosts: all
  gather_facts: true
  tasks:
    - name: Ping all hosts
      ansible.builtin.ping:

    - name: Print OS family
      ansible.builtin.debug:
        msg: "{{ inventory_hostname }} is running {{ ansible_os_family }}"

    - name: Check disk usage
      ansible.builtin.command: df -h /
      changed_when: false

    - name: Report uptime
      ansible.builtin.command: uptime
      changed_when: false
```

**What this tests in Ursula:**
- `PLAY [...]` and `TASK [...]` headings render as plain `stdout` lines.
- `ok:` lines are color-coded green in the PLAY RECAP.
- `changed_when: false` keeps the recap clean — good baseline to verify no false positives.
- `ansible.builtin.debug` output appears as regular stdout and confirms fact-gathering works.
- Final `ansible-complete` event fires with `success = true`, turning the Run button state green.

---

### 2. `deploy-validate.yml` — Deliberate failure + rescue flow

Exercises Ursula's error/warning color paths. The second task intentionally fails on a missing variable, triggering a `rescue:` block so the run completes but PLAY RECAP shows `failed=1`. This validates that Ursula correctly reports a failed run without crashing and that the Stop button is not needed.

```yaml
# playbook/deploy-validate.yml
---
- name: Deploy validation — failure and rescue
  hosts: all
  gather_facts: false
  vars:
    required_version: "{{ app_version | default('') }}"

  tasks:
    - name: Verify required variable is set
      block:
        - name: Fail if app_version not provided
          ansible.builtin.fail:
            msg: "app_version must be passed with -e app_version=X.Y.Z"
          when: required_version == ""

        - name: Print target version
          ansible.builtin.debug:
            msg: "Deploying version {{ required_version }}"

      rescue:
        - name: Log missing variable and abort gracefully
          ansible.builtin.debug:
            msg: "Deployment aborted — set app_version before running this playbook."

    - name: Always run cleanup check
      ansible.builtin.command: echo "cleanup step always runs"
      changed_when: false
```

**What this tests in Ursula:**
- `fatal:` lines stream and are highlighted red by `categorize_ansible_line()`.
- The `rescue:` block emits additional `ok:` lines after the failure, confirming that Ursula continues streaming after an error rather than cutting off.
- PLAY RECAP line includes `failed=1`, verifying that the `ansible-complete` event fires with `success = false` and the UI reflects the failed state.
- The `--limit` field can be used here to scope the run to a single host, exercising that toolbar input path.

**Run with:**
```bash
# Trigger the failure path (missing variable)
ansible-playbook -i inventory/staging.yml playbook/deploy-validate.yml

# Trigger the success path
ansible-playbook -i inventory/staging.yml playbook/deploy-validate.yml -e app_version=1.2.0
```

---

## Project Structure

```
ursula/
├── src/
│   ├── App.tsx           # All UI components (single-file by design)
│   ├── main.tsx          # React entry point
│   ├── styles.css        # All styles + theme definitions
│   ├── store/
│   │   └── appStore.ts   # Zustand store — all state and Tauri invocations
│   └── types/
│       └── index.ts      # Shared TypeScript interfaces
├── src-tauri/
│   └── src/
│       ├── lib.rs         # Tauri setup, command registration
│       └── commands/
│           └── mod.rs     # All invokable commands (run, kill, git, config, etc.)
├── package.json
└── tauri.conf.json
```

---

## License

See repository for license details.
